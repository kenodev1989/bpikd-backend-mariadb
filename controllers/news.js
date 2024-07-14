import Person from '../models/personPost.js';
import News from '../models/news.js';
import { agenda } from '../utils/agenda.js'; // Ensure this path is correct

import moment from 'moment-timezone';

import User from '../models/admin.js';

export const addNews = async (req, res) => {
  let data;

  try {
    if (typeof req.body.data === 'string') {
      data = JSON.parse(req.body.data);
    } else {
      data = req.body;
    }
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON data provided.' });
  }
  const {
    category,
    title,
    content,
    publishTime,
    scheduledPublishTime,
    externalSource,
    visibility,
    isPublished,
  } = data;

  let featuredImage;
  if (req.files?.featuredImage?.[0]) {
    const file = req.files.featuredImage[0];
    featuredImage = `${req.protocol}://${req.get('host')}/uploads/${
      file.filename
    }`;
  } else {
    featuredImage = null; // Handle the case where there's no featured image
  }

  // Extracting user from request, assuming middleware already validates and sets user
  const user = await User.findOne({ _id: req.user._id }); // Assuming your authentication middleware sets `req.user`

  // Construct the news item object, including the user who created it
  const newNewsItem = {
    category,
    title,
    content,
    publishTime: publishTime !== 'Schedule' ? new Date() : null,
    scheduledPublishTime,
    externalSource,
    visibility,
    isPublished: isPublished === 'true', // Convert to boolean if necessary
    featured: featuredImage,
    createdBy: user.username, // or user.username, depending on your schema
  };

  try {
    const newsItem = new News(newNewsItem);
    const savedNewsItem = await newsItem.save();

    if (publishTime === 'Schedule' && scheduledPublishTime) {
      const scheduledTimeUTC = moment
        .tz(scheduledPublishTime, 'Europe/Berlin')
        .utc()
        .toISOString();
      await agenda.schedule(scheduledTimeUTC, 'publish news', {
        newsItemId: savedNewsItem._id,
      });
    }

    return res.status(201).json(savedNewsItem);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
export const getAllNews = async (req, res) => {
  try {
    const newsItems = await News.find({}).sort({ createdAt: -1 }); // Fetch all news items and sort them by creation date
    res.json(newsItems);
  } catch (error) {
    console.error('Error fetching news items:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Controller to get a specific news item by ID
export const getNewsById = async (req, res) => {
  try {
    const newsId = req.params.id; // Extract the news ID from the request parameters
    const newsItem = await News.findById(newsId);

    if (!newsItem) {
      return res.status(404).json({ message: 'News item not found' });
    }

    res.json(newsItem);
  } catch (error) {
    console.error('Error fetching news item:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Function to create a delete controller for a given model
const createDeleteController = (Model) => {
  // Return the actual controller function
  return async (req, res) => {
    try {
      const { postId } = req.params; // Renamed `postId` to `id` for generality
      const document = await Model.findByIdAndDelete(postId);

      if (!document) {
        return res.status(404).json({ message: 'Document not found.' });
      }

      res.json({ message: 'Document deleted successfully.' });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: 'An error occurred while deleting the document.' });
    }
  };
};

// Function to create a delete multiple controller for a given model
const createDeleteMultipleController = (Model) => {
  // Return the actual controller function
  return async (req, res) => {
    try {
      const { ids } = req.body; // Assuming an array of ids
      const result = await Model.deleteMany({
        _id: { $in: ids },
      });

      res.json({
        message: `${result.deletedCount} documents have been successfully deleted.`,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: 'An error occurred while deleting documents.' });
    }
  };
};

// Creating specific delete controllers for each model
export const deleteNewsPost = createDeleteController(News);
export const deleteMultipleNewsPosts = createDeleteMultipleController(News);

export const deletePerson = createDeleteController(Person);
export const deleteMultiplePersons = createDeleteMultipleController(Person);
