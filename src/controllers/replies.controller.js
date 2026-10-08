import { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";

const addReply = asyncHandler(async (req, res) => {
    const { videoId, commentId } = req.params;
    const { content } = req.body;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "invalid videoId sent");
    }

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "invalid commentId sent");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "No such video found");
    }

    const parent = await Comment.findById(commentId);
    if (!parent) {
        throw new ApiError(404, "No such parent comment found");
    }

    if (parent.parentComment !== null) {
        throw new ApiError(
            400,
            "Cannot reply to a reply. Only top-level comments can be replied to."
        );
    }

    if (content?.trim() === "") {
        throw new ApiError(400, "no content in the reply");
    }

    const reply = await Comment.create({
        video: videoId,
        content,
        owner: req.user._id,
        parentComment: commentId,
    });

    if (!reply) {
        throw new ApiError(500, "Failed to create the reply");
    }

    const replyWithAllDetails = await Comment.aggregate([
        {
            $match: {
                _id: reply._id,
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $unwind: "$owner",
                    },
                    {
                        $project: {
                            title: 1,
                            views: 1,
                            isPublished: 1,
                            owner: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$video",
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$owner",
        },
        {
            $lookup: {
                from: "comments",
                localField: "parentComment",
                foreignField: "_id",
                as: "parentComment",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $unwind: "$owner",
                    },
                    {
                        $lookup: {
                            from: "videos",
                            localField: "video",
                            foreignField: "_id",
                            as: "video",
                            pipeline: [
                                {
                                    $lookup: {
                                        from: "users",
                                        localField: "owner",
                                        foreignField: "_id",
                                        as: "owner",
                                        pipeline: [
                                            {
                                                $project: {
                                                    fullName: 1,
                                                    username: 1,
                                                    avatar: 1,
                                                },
                                            },
                                        ],
                                    },
                                },
                                {
                                    $unwind: "$owner",
                                },
                                {
                                    $project: {
                                        title: 1,
                                        views: 1,
                                        isPublished: 1,
                                        owner: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $unwind: "$video",
                    },
                ],
            },
        },
        {
            $unwind: "$parentComment",
        },
    ]);

    return res
        .status(201)
        .json(
            new ApiResponse(201, replyWithAllDetails, "Reply created successfully")
        );
});

const getReplies = asyncHandler(async (req, res) => {
    const { videoId, commentId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId sent");
    }

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "invalid commentId sent");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "No such video found");
    }

    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
        throw new ApiError(404, "no such parent comment found");
    }

    const replies = await Comment.aggregatePaginate(
        Comment.aggregate([
            {
                $match: {
                    parentComment: new mongoose.Types.ObjectId(commentId),
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner",
                    pipeline: [
                        {
                            $project: {
                                fullName: 1,
                                username: 1,
                                avatar: 1,
                            },
                        },
                    ],
                },
            },
        ])
    );

    if (!replies) {
        throw new ApiError(500, "Failed to fetch the replies to the comment");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, replies, "Replies fetched successfully"));
});

const updateReply = asyncHandler(async (req, res) => {
    const { commentId, replyId } = req.params;
    const { content } = req.body;

    if (!content.trim()) {
        throw new ApiError(401, "No content found while editing the reply");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new ApiError(404, "No such comment found");
    }

    const reply = await Comment.findById(replyId);
    if (!reply) {
        throw new ApiError(404, "No such reply found");
    }

    if (req?.user?._id?.toString() !== reply?.owner?.toString()) {
        throw new ApiError(401, "Only the owner of the reply can edit it");
    }

    if (reply.parentComment.toString() !== comment._id.toString()) {
        throw new ApiError("parent comment doesn't match");
    }

    const updatedReply = await Comment.findByIdAndUpdate(
        replyId,
        {
            $set: {
                content,
            },
        },
        {
            new: true,
        }
    );

    if (!updatedReply) {
        throw new ApiError(500, "Failed to update the reply");
    }

    res.status(200).json(
        new ApiResponse(200, updatedReply, "Reply updated successfully")
    );
});

const deleteReply = asyncHandler(async (req, res) => {
    const { commentId, replyId } = req.params;

    if (!isValidObjectId(commentId)) {
        throw new ApiError("Invalid commentId sent while deleting comment");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new ApiError(404, "No such comment found");
    }

    if (!isValidObjectId(replyId)) {
        throw new ApiError(400, "invalid replyId sent");
    }

    const reply = await Comment.findById(replyId);
    if (!reply) {
        throw new ApiError(404, "No such reply found");
    }

    if (reply.parentComment.toString() !== comment._id.toString()) {
        throw new ApiError(400, "parent comment does not match");
    }

    if (req?.user?._id.toString() !== reply.owner.toString()) {
        throw new ApiError(401, "Not authorized to delete this reply");
    }

    await Comment.findByIdAndDelete(replyId);

    res.status(200).json(
        new ApiResponse(200, {}, "Reply deleted successfully")
    );
});

export { addReply, getReplies, updateReply, deleteReply };
