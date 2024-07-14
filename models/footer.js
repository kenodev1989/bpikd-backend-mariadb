import mongoose from 'mongoose';

const footerSchema = new mongoose.Schema({
  companies: [
    {
      company: String,
      src: String,
      description: String,
      url: String,
    },
  ],
});

const FooterConfig = mongoose.model('Footer', footerSchema);

export default FooterConfig;
