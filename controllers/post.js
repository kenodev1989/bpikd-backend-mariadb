import Person from '../models/personPost.js';
import News from '../models/news.js';
import { agenda } from '../utils/agenda.js'; // Ensure this path is correct
import { replaceDiacritics } from '../utils/replaceDiacritics.js';

import moment from 'moment-timezone';

import User from '../models/admin.js';

// Assuming 'scheduledPublishTime' is in local time and you want to convert it to UTC

// Controller to get all news items

export const addOrUpdatePersonAndWork = async (req, res) => {
  const data = JSON.parse(req.body.data);

  const {
    person: personData,
    category,
    title,
    content,
    publishTime,
    scheduledPublishTime,
    externalSource,
    visibility,
    isPublished,
  } = data;

  try {
    let existingPerson = await Person.findOne({
      'person.firstName': {
        $regex: new RegExp('^' + personData.firstName + '$', 'i'),
      },
      'person.lastName': {
        $regex: new RegExp('^' + personData.lastName + '$', 'i'),
      },
    });

    let featuredImage;

    if (
      req.files &&
      req.files.featuredImage &&
      req.files.featuredImage.length > 0
    ) {
      const file = req.files.featuredImage[0];
      featuredImage = `${req.protocol}://${req.get('host')}/uploads/${
        file.filename
      }`;
    } else {
      featuredImage = null; // or set a default value or handle the case where there's no featured image
    }

    // Assuming the featured image is uploaded with the field name 'featuredImage
    // Construct media object from uploaded files
    const mediaFiles = {
      images: req.files['images']
        ? req.files['images'].map((file) => ({
            url: `${req.protocol}://${req.get('host')}/uploads/${
              file.filename
            }`,
            name: file.name,
            type: file.mimetype,
          }))
        : [],
      audios: req.files['audios']
        ? req.files['audios'].map((file) => ({
            url: `${req.protocol}://${req.get('host')}/uploads/${
              file.filename
            }`,
            name: file.originalname,
            fileType: file.mimetype,
          }))
        : [],
      videos: req.files['videos']
        ? req.files['videos'].map((file) => ({
            url: `${req.protocol}://${req.get('host')}/uploads/${
              file.filename
            }`,
            name: file.originalname,
            fileType: file.mimetype,
          }))
        : [],
      documents: req.files['documents']
        ? req.files['documents'].map((file) => ({
            url: `${req.protocol}://${req.get('host')}/uploads/${
              file.filename
            }`,
            name: file.originalname,
            fileType: file.mimetype,
          }))
        : [],
    };

    const user = await User.findOne({ _id: req.user._id }); //

    const newWork = {
      title,
      media: mediaFiles,
      content,
      publishTime,
      scheduledPublishTime,
      externalSource,
      visibility,
      isPublished,
      createdBy: user.username,
    };

    let workId;

    let workAction;
    let publicationStatus;

    // Now convert the ISO format date to UTC with moment-timezone
    const scheduledTimeUTC = moment
      .tz(scheduledPublishTime, 'Europe/Berlin')
      .utc()
      .toISOString();

    if (!existingPerson) {
      const newPerson = new Person({
        person: {
          ...personData,
          featured: featuredImage,
          createdBy: user.username,
        },
        works: [newWork],
        category,
        visibility,
      });

      const savedPerson = await newPerson.save();
      workId = savedPerson.works[savedPerson.works.length - 1]._id;
      workAction = 'created';
    } else {
      existingPerson.works.push(newWork);
      const updatedPerson = await existingPerson.save();
      workId = updatedPerson.works[updatedPerson.works.length - 1]._id;
      workAction = 'added to existing person';
    }

    // Schedule publication if required
    if (publishTime === 'Schedule' && scheduledPublishTime) {
      await agenda.schedule(scheduledTimeUTC, 'publish work', { workId });
      publicationStatus = `scheduled for ${scheduledPublishTime}`;
    } else publicationStatus = 'published immediately';

    const message = `Work ${workAction} and ${publicationStatus}.`;

    return res.status(200).json({ message: message, workId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

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

// Display details of a specific person
export const displayPersonDetails = async (req, res) => {
  try {
    const personId = req.params.id; // Assuming the ID is passed as a URL parameter
    const person = await Person.findById(personId);
    res.json(person.person); // Send the 'person' subdocument as the response
  } catch (error) {
    console.error('Failed to fetch person details:', error);
    res.status(500).send('Failed to fetch person details');
  }
};

// Display detailed data of a specific person, including populated works
export const displayPersonData = async (req, res) => {
  console.log(req);
  try {
    const personId = req.params.id;
    const person = await Person.findById(personId).populate('works');
    res.json(person); // Send the entire person document as the response
  } catch (error) {
    console.error('Failed to fetch person data:', error);
    res.status(500).send('Failed to fetch person data');
  }
};

// Display details of all persons
export const getAllPersons = async (req, res) => {
  try {
    const persons = await Person.find(
      {},
      {
        'person.firstName': 1,
        'person.lastName': 1,
        'person.aboutPerson': 1,
        'person.featured': 1,
        'person.createdBy': 1,
      }
    );
    res.json(persons); // Send the list of persons as the response
  } catch (error) {
    console.error('Failed to fetch persons:', error);
    res.status(500).send('Failed to fetch persons');
  }
};

// Controller to search users by first name and last name
export const searchUsersByPartialName = async (req, res) => {
  // Extract query parameter
  const { searchQuery } = req.query;

  const replaceReg = replaceDiacritics(searchQuery);

  const regex = new RegExp(replaceReg, 'i');

  try {
    // Use a regular expression for partial, case-insensitive matching
    // The 'i' flag makes the search case-insensitive

    // Search for users where either first name or last name matches the regex
    const users = await Person.find(
      {
        $or: [{ 'person.firstName': regex }, { 'person.lastName': regex }],
      },
      // Project only specific fields and exclude 'person.aboutPerson'
      {
        'person.firstName': 1,
        'person.lastName': 1,
        'person.featured': 1,
        // Do not try to exclude 'person.aboutPerson' here; it's implicitly excluded by not being included.
      }
    ).lean(); // Add

    if (users.length === 0) {
      return res.status(404).json({ message: 'No users found.' });
    }

    res.json(users);
  } catch (error) {
    console.error('Search users by partial name error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export async function deletePost(req, res) {
  try {
    // Assuming the post ID to delete is passed as a URL parameter (e.g., /posts/:id)
    const { postId } = req.params;

    const post = await Person.findByIdAndDelete(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    // Post deleted successfully
    res.json({ message: 'Post deleted successfully.' });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: 'An error occurred while deleting the post.' });
  }
}

export async function deleteMultiplePosts(req, res) {
  try {
    // The request should contain an array of post IDs to be deleted
    const { postIds } = req.body;

    // Perform the delete operation
    const result = await Post.deleteMany({
      _id: { $in: postIds },
    });

    // Respond with success message
    // result.deletedCount tells you how many documents were deleted
    res.json({
      message: `${result.deletedCount} posts have been successfully deleted.`,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: 'An error occurred while deleting posts.' });
  }
}
