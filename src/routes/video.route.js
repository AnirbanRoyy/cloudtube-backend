import { Router } from "express";
import {
    deleteVideo,
    getAllVideos,
    getSelfVideos,
    getVideoById,
    publishVideo,
    togglePublishVideo,
    updateVideo,
} from "../controllers/video.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    addComment,
    deleteComment,
    getVideoComments,
    updateComment,
} from "../controllers/comment.controller.js";
import { addReply, getReplies } from "../controllers/replies.controller.js";

const router = Router();

// CRUD operations
router.route("/").post(
    upload.fields([
        {
            name: "videoFile",
            maxCount: 1,
        },
        {
            name: "thumbnail",
            maxCount: 1,
        },
    ]),
    verifyJWT,
    publishVideo
);
router.route("/").get(getAllVideos);
router.route("/:videoId").get(getVideoById);
router
    .route("/:videoId")
    .patch(verifyJWT, upload.single("thumbnail"), updateVideo);
router.route("/:videoId").delete(verifyJWT, deleteVideo);

// actions
router.route("/get-self-videos").post(verifyJWT, getSelfVideos);
router.route("/toggle-publish/:videoId").post(verifyJWT, togglePublishVideo);

// Comment CRUD operation routes
router.route("/:videoId/comments").post(verifyJWT, addComment);
router.route("/:videoId/comments").get(getVideoComments);
router.route("/:videoId/comments/:commentId").patch(verifyJWT, updateComment);
router.route("/:videoId/comments/:commentId").delete(verifyJWT, deleteComment);

// Replies CRUD opeartion routes
router.route("/:videoId/comments/:commentId/replies").post(verifyJWT, addReply);
router.route("/:videoId/comments/:commentId/replies").get(getReplies);
router
    .route("/:videoId/comments/:commentId/replies/:replyId")
    .patch(verifyJWT, updateComment);
router
    .route("/:videoId/comments/:commentId/replies/:replyId")
    .delete(verifyJWT, deleteComment);

export default router;
