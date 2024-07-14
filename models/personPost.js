import mongoose from 'mongoose';

const { Schema } = mongoose;

const mediaSchema = new Schema({
  images: [
    {
      url: { type: String },
      name: { type: String },
      fileType: { type: String }, // Explicitly defining 'type' as a field
    },
  ],
  audios: [
    {
      url: { type: String },
      name: { type: String },
      fileType: { type: String },
    },
  ],
  videos: [
    {
      url: { type: String },
      name: { type: String },
      fileType: { type: String },
    },
  ],
  documents: [
    {
      url: { type: String },
      name: { type: String },
      fileType: { type: String },
    },
  ],
});

const workSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  publishTime: { type: String, required: true },
  isPublished: { type: Boolean, required: true },
  scheduledPublishTime: Date,
  externalSource: String,
  media: [mediaSchema],
  createdBy: String,
});

const personDetailsSchema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    aboutPerson: { type: String, required: true },
    featured: String,
    createdBy: String,
  },
  { timestamps: true }
);

const personSchema = new Schema({
  person: personDetailsSchema,
  works: [workSchema],
  category: { type: String, required: true },
  visibility: String,
});

const Person = mongoose.model('Person', personSchema);

export default Person;
