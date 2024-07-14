import { SortItems } from '../models/sortItems.js';

export const updateOrCreateSortItems = async (req, res, next) => {
  const { firstRowItems, secondRowItems, _id, userId } = req.body;

  try {
    const updatedOrNewDocument = await SortItems.findOneAndUpdate(
      { _id },
      { firstRowItems, secondRowItems },
      {
        new: true, // Return the modified document rather than the original
        upsert: true, // Create a new document if one doesn't exist
        runValidators: true, // Run model validators on update
        setDefaultsOnInsert: true, // Apply the default values specified in the model's schema
      }
    );

    res.status(200).json(updatedOrNewDocument);
  } catch (error) {
    next(error);
  }
};

// Handler to fetch all sorted items
export const getAllSortedItems = async (req, res, next) => {
  try {
    const sortedItems = await SortItems.find({}).exec(); // Fetch all documents without filtering
    res.status(200).json(sortedItems);
  } catch (error) {
    next(error); // Pass errors to Express's default error handler
  }
};
