# YouTube Backend (MERN) — CLAUDE.md

@../plan/CONTEXT.md

CRUD YouTube-clone backend (Node + Express + MongoDB/Mongoose), loosely based on the Chai aur Code course. A frontend (Vite + React + TailwindCSS + ShadCN) will be built next, and this backend will be upgraded substantially. Repo: `github.com/AnirbanRoyy/YouTube-BackEnd`.

## Commands
- `npm run dev` — `nodemon ./src/index.js` (the only real script; no `start`, `test` is a placeholder that exits 1).
- `package.json` `main` is `index.js` (wrong); real entry is `src/index.js`.
- ESM (`"type": "module"`): named imports, always include `.js` extensions.
- Formatting: Prettier (no config file) — 4-space indent, double quotes, semicolons.

## Stack
bcrypt, cloudinary, cookie-parser, cors, dotenv, express 4, jsonwebtoken, mongoose 8, mongoose-aggregate-paginate-v2, multer 1. Dev: nodemon, prettier. No tests, linter, validation lib, rate limiting, helmet, logger, Docker, or CI.

## Environment variables (no `.env` / `.env.example` exists; `.env` is gitignored)
`PORT` (default 3000), `MONGODB_URI` (must NOT include a db path/query; `DB_NAME` "YouTube" is appended), `CORS_ORIGIN`, `ACCESS_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
README omits `CORS_ORIGIN` and the two `*_EXPIRY` vars.

## Layout
```
src/
  index.js            dotenv/config -> connectDb() -> app.listen
  app.js              middleware, routers, error handler
  constants.js        export const DB_NAME = "YouTube"
  db/connectDB.js
  middlewares/        auth.middleware.js (verifyJWT), multer.middleware.js
  models/             user video comment like playlist subscription tweet view (.model.js)
  controllers/        user video comment playlist subscription tweet (.controller.js)
  routes/             user video comment tweet subscription playlist (.route.js)
  utils/              ApiError, ApiResponse, asyncHandler, cloudinary, deleteCloudinary
public/temp/          multer temp upload dir (also exposed by express.static)
```

## App bootstrap (`src/app.js`)
Order: `express.json(16kb)`, `urlencoded(16kb)`, `static("public")`, `cors({origin: CORS_ORIGIN, credentials: true})`, `cookieParser()`, routers, error handler (last).
Routers under `/api/v1/`: `users`, `videos`, `comments`, `tweets`, `subscriptions`, `playlists`.
Error handler: `ApiError` -> `{success:false, statusCode, message, errors}`; anything else -> 500 and leaks the raw error object. No 404 catch-all, no health route.
DB connect catches/logs its own errors, so the server starts even if Mongo fails.

## Models (all `timestamps: true`; paginate plugin on User, Video, Comment, Tweet, Playlist)
- **User**: fullName, username (unique, lowercase), email (unique), password, avatar (URL, required), coverImage, watchHistory [Video], refreshToken. Pre-save bcrypt (10 rounds). Methods: `isPasswordCorrect`, `generateAccessToken`, `generateRefreshToken`.
- **Video**: videoFile, thumbnail, title, description, views (0), isPublished (true), owner. No duration.
- **Comment**: content, video, owner, parentComment (replies).
- **Tweet**: owner, content.
- **Playlist**: name, description, `video` [Video] (singular name, array), owner.
- **Subscription**: subscriber, channel (no unique compound index).
- **Like**: comment/video/tweet refs, likedBy — model only, NO controller/routes.
- **View**: video, viewer — intended for unique-view counting in `getVideoById`.

## Routes
Legend: 🔒 = verifyJWT.

**Users** `/api/v1/users`
- `POST /` (multer avatar+coverImage) register · `GET /` 🔒 list · `GET /:userId` 🔒 · `PATCH /:userId` 🔒 (email/fullName, self only) · `DELETE /:userId` 🔒 (self only)
- `POST /login` · `POST /logout` 🔒 · `POST /refresh-token` · `POST /change-password` 🔒
- `POST /get-current-user` 🔒 · `POST /get-user-profile/:username` 🔒 (aggregate: subscriber counts, isSubscribed)
- `PATCH /update-avatar` 🔒 · `PATCH /update-cover-image` 🔒 (see bugs: unreachable)
- `POST /get-watch-history` 🔒 · `POST /add-to-watch-history/:videoId` 🔒 · `POST /remove-from-watch-history/:videoId` 🔒
- `POST /:userId/playlists` 🔒 · `POST /:userId/tweets` 🔒

**Videos** `/api/v1/videos`
- `POST /` (multer videoFile+thumbnail, then 🔒) publish · `GET /` list (published only, paginated) · `GET /:videoId` · `PATCH /:videoId` 🔒 (thumbnail) · `DELETE /:videoId` 🔒
- `POST /get-self-videos` 🔒 · `POST /toggle-publish/:videoId` 🔒
- Comments: `POST /:videoId/comments` 🔒 · `GET /:videoId/comments` · `PATCH|DELETE /:videoId/comments/:commentId` 🔒

**Comments (replies only)** `/api/v1/comments`: `POST|GET /:commentId/replies` 🔒, `PATCH|DELETE /:commentId/replies/:replyId` 🔒. `getAllComments` is exported but not routed.

**Tweets** `/api/v1/tweets`: `POST /` 🔒, `GET /`, `GET /:tweetId`, `PATCH|DELETE /:tweetId` 🔒.

**Subscriptions** `/api/v1/subscriptions`: `PATCH /toggle-subscription/:channelId` 🔒, `GET /get-channel-subscribers/:channelId`, `GET /get-subscribed-channels/:subscriberId` 🔒.

**Playlists** `/api/v1/playlists`: `POST /` 🔒, `GET|PATCH|DELETE /:playlistId` 🔒.

## Auth flow
- Login (username or email + password) issues access + refresh tokens; refresh token stored on user; both set as cookies `{httpOnly:true, secure:true}` and also returned in JSON.
- `verifyJWT` reads `req.cookies.accessToken` or `Authorization: Bearer`, verifies, loads user (`-password -refreshToken`) into `req.user`.
- `/refresh-token` rotates tokens (compares to the stored one).
- Ownership checks live in controllers (`req.user._id` vs `owner`), returning 403.
- `secure:true` cookies can break over plain http on localhost; the frontend dev setup needs to account for this (CORS_ORIGIN + credentials).

## Upload flow
Multer -> `public/temp` (no extension, no type filter, no size limit) -> controller calls `uploadOnCloudinary(path)` (`resource_type:"auto"`, deletes temp file, returns null on error) -> store `.url`. Replacing assets calls `deleteFromCloudinary(oldUrl)` (derives public id from URL; no `resource_type`, so videos are not actually deleted).

## Code conventions
- Controllers: `const x = asyncHandler(async (req, res) => {...})`, exported via `export { ... }` at the bottom. Models: `export const`.
- Responses: `res.status(n).json(new ApiResponse(n, data, "message"))`; errors: `throw new ApiError(status, message)`.
- Status codes: 201 create, 204 delete (body is dropped by clients), 400 bad input/id, 401 auth, 403 not owner, 404 not found.
- Validation is ad hoc (`isValidObjectId`, `.trim()===""`). Pagination via `page`/`limit` (default 1/10) with `aggregatePaginate`; list response shape is inconsistent (`getAllUsers` returns only `docs`, `getAllVideos` returns the full paginate object).

## Known bugs / gaps (fix as part of the upgrade)
**Routing**
- `user.route.js`: `PATCH /:userId` is declared before `/update-avatar` and `/update-cover-image`, which swallows them (400 invalid ObjectId). Reorder.
- `GET /videos/:videoId` has no verifyJWT, so `req.user` is never set and view counting / View records never run (needs optional auth).
- Many read endpoints use POST (get-current-user, get-user-profile, get-watch-history, get-self-videos, `/:userId/playlists|tweets`) — should become GET for the frontend.
- Multer runs before auth on `POST /videos`, so unauthenticated uploads hit disk.
- README endpoint list is stale and does not match actual routes.

**Security / correctness**
- `generateAccessToken` puts the password hash in the JWT payload — remove.
- `verifyJWT` turns every failure into 500 (expired token should be 401); missing Authorization header throws TypeError. `refreshAccessToken` has the same issue.
- Error handler leaks raw error objects in 500s.
- `createPlaylist` takes `owner` from the body instead of `req.user`; crashes if `video` undefined.
- `getSubscribedChannels` trusts `subscriberId` from the URL; `getChannelSubscribers` does `new ObjectId()` before `isValidObjectId`.
- `toggleSubscription` allows self-subscribe and has no unique index.
- `comment.controller.js`: `new ApiError("message")` with message in the status slot (`addReply` ~341, `updateReply` ~432, `deleteReply` ~460); 401 used where 403 intended.
- `registerUser`: duplicate check uses raw username while saved username has spaces stripped; `avatar.url` crashes if upload returns null; missing-field checks pass on `undefined`.
- `updateAvatar` calls `fs.unlinkSync` on a file the helper already deleted (ENOENT); `uploadOnCloudinary` catch also unlinks without existence check.
- Temp files leak when validation fails before upload.
- `loginUser` returns ApiResponse code 201 inside HTTP 200; logout `$set refreshToken: undefined` may not unset; changing password doesn't invalidate refresh token.
- `deleteUser` / `deleteVideo` leave orphans (Cloudinary assets, comments, tweets, subscriptions, playlists, likes, views).
- `deleteFromCloudinary` is wrapped in `asyncHandler` (errors go to `next` undefined) and logs "avatar" for everything.
- `DB connect` doesn't exit on failure; `CORS_ORIGIN` undefined if unset.
- Cleanup: `console.log("HEY")` in `video.controller.js` (~310), unused `mongo` import in `connectDB.js`, unused `Mongoose` import in `subscription.controller.js`, `constants.js` has no trailing newline.

**Missing features**
- Likes (model exists, no API: video/comment/tweet likes, liked videos), search/sort/filter on videos, video duration, channel dashboard/stats, playlist add/remove-video endpoints, pagination for subscribers/subscribed/watch history, tests, request validation, rate limiting, helmet, logging, `.env.example`, email verification, password reset, health check, 404 handler.

## Notes for the frontend work
- API base: `/api/v1`. Auth via httpOnly cookies (needs `credentials: "include"`, matching `CORS_ORIGIN`) or `Authorization: Bearer`.
- Expect to normalize response shapes (`ApiResponse {statusCode, data, message, success}`) and fix pagination/REST inconsistencies above before building the UI on top.
