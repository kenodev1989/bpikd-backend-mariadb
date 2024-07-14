import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const personSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  featured: { type: String, required: true }, // Assuming this is a URL to an image
});

const itemSchema = new Schema(
  {
    person: personSchema,
  },
  { _id: true }
); // Include _id in the itemSchema

const rowItemsSchema = new Schema({
  firstRowItems: {
    type: itemSchema, // Single object for the first row
    required: true,
  },
  secondRowItems: [itemSchema], // Array of objects for the second row
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
});

export const SortItems = model('SortItems', rowItemsSchema);
