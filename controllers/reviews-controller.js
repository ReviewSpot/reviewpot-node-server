import { AlbumRating } from "../models/album-rating.js";
import commentDao from "../models/daos/comment-dao.js";
import reviewDao from "../models/daos/review-dao.js";
import { getAlbumData } from "../services/spotify/spotify-album-service.js";
import {
    getPageFromModelList,
    validateOffsetAndLimit,
} from "../utils/pagination.js";

// api/v1/album/:albumId/review/:reviewId
export const getReview = async (req, res) => {
    const albumId = req.params.albumId;
    const [albumData, albumError] = await getAlbumData(albumId);
    if (albumError) {
        res.status(500);
        res.json({
            errors: [
                "Could not retrieve album data due to an internal server error. Please try again or contact a site contributor.",
            ],
        });
        return;
    }

    const reviewId = req.params.reviewId;
    const [review, reviewError] = await reviewDao.findOneReviewById(reviewId);
    if (reviewError) {
        res.status(500);
        res.json({
            errors: [
                "Could not retrieve review data due to an internal server error. Please try again or contact a site contributor.",
            ],
        });
        return;
    }

    res.status(200);
    res.json({
        albumData,
        review,
    });
};

// api/v1/album/:albumId/review/:reviewId/comments
export const getCommentsForReview = async (req, res) => {
    if (
        !req.body.limit ||
        req.body.offset == null ||
        !validateOffsetAndLimit(req.body.offset, req.body.limit)
    ) {
        res.status(400);
        res.json({
            errors: ["Must send an offset and a limit with this request."],
        });
        return;
    }

    const [limit, offset] = [req.body.limit, req.body.offset];
    const reviewId = req.params.reviewId;
    const [comments, commentsDaoError] =
        await commentDao.getAllCommentsWithReviewId(reviewId);
    // TODO: What happens if this review does not exist?
    if (commentsDaoError) {
        res.status(500);
        res.json({
            errors: [
                "An internal server error occured while trying to retrieve the comments for this review." +
                    "Please try again or contact a site contributor.",
            ],
        });
        return;
    }
    if (!comments) {
        res.status(404);
        res.json({
            errors: ["There are no comments for this review."],
        });
    }

    if (offset * limit >= comments.length && offset != 0) {
        res.status(400);
        res.json({
            errors: [
                "The given offset is out of range for the total number of items.",
            ],
        });
        return;
    }

    const paginationData = getPageFromModelList(comments, offset, limit);
    const { next, prev } = paginationData;
    const commentsSlice = paginationData.listSlice;

    res.status(200);
    res.json({
        comments: commentsSlice,
        next,
        prev,
        total: comments.length,
    });
};

// api/v1/album/:albumId/review
export const createAReview = async (req, res) => {
    if (!req.body.content || req.body.content === "") {
        res.sendStatus(400);
        return;
    }

    const albumId = req.params.albumId;
    const currentUserId = req.session.currentUser._id;
    try {
        const ratingWillBeCreated = req.body.rating != null;
        const ratingAlreadyExists = await AlbumRating.exists({
            albumId,
            rater: currentUserId,
        });
        if (!ratingWillBeCreated && !ratingAlreadyExists) {
            res.status(400);
            res.json({
                errors: [
                    "To write a review, a rating must be provided in the creation request of already " +
                        "exist for this album by the user.",
                ],
            });
            return;
        }
    } catch (error) {
        res.status(500);
        res.json({
            errors: [
                "An internal server error occurred while attempting to create this review. " +
                    "Please try again or contact a site contributor.",
            ],
        });
        return;
    }

    const [review, creationError] =
        req.body.rating != null
            ? await reviewDao.createReview(
                  req.session.currentUser._id,
                  albumId,
                  req.body.content
              )
            : await reviewDao.createReview(
                  req.session.currentUser._id,
                  albumId,
                  req.body.content,
                  req.body.rating
              );

    if (creationError) {
        res.status(500);
        res.json({
            errors: [
                "An internal server error was encountered while attempting to create this review." +
                    "Please try again or contact a site admin.",
            ],
        });
        return;
    }

    res.status(200);
    res.json(review);
};

// api/v1/album/:albumId/review/:reviewId
export const deleteAReview = async (req, res) => {
    const reviewId = req.params.reviewId;
    const [successFullyDeleted, error] = await reviewDao.deleteAReview(
        reviewId
    );
    if (error || !successFullyDeleted) {
        res.status(500);
        res.json({
            errors: [
                "An internal server error occurred trying to delete this review. " +
                    "Please try again or contact a site contributor.",
            ],
        });
        return;
    }

    res.sendStatus(200);
};
