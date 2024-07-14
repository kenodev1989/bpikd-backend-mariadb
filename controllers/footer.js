import FooterConfig from '../models/footer.js';
import multer from 'multer';
import path from 'path';

// Set up storage for images

const storage = multer.diskStorage({
  destination: './public/uploads/footer',
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + '-' + Date.now() + path.extname(file.originalname)
    );
  },
});

export const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000000000000000 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

function checkFileType(file, cb) {
  // Allowed ext
  const filetypes = /jpeg|jpg|png|gif|mp4|avi|mpeg|mp3|wav|pdf|doc|docx/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Files Only!');
  }
}

export const uploadMiddleware = upload.fields([
  { name: 'companyImage-0' },
  { name: 'companyImage-1' },
  { name: 'companyImage-2' },
  { name: 'companyImage-3' },
  { name: 'companyImage-4' },
  // Add more if you expect more companies
  // This setup expects up to 5 companies, each with one image. Adjust accordingly.
]);

export const updateFooterConfig = async (req, res) => {
  try {
    const companiesData = req.body.companies;

    console.log(companiesData); // Corrected from "comaniesData" to "companiesData"
    const updatedCompanies = companiesData.map((company, index) => {
      // Check if there's an uploaded file for this company
      const file = req.files[`companyImage-${index}`]
        ? req.files[`companyImage-${index}`][0]
        : null;
      return {
        ...company,
        src: file
          ? `${req.protocol}://${req.get('host')}/uploads/footer/${
              file.filename
            }`
          : company.src,
      };
    });

    const result = await FooterConfig.findOneAndUpdate(
      {}, // An empty filter selects the first document in the collection
      { $set: { companies: updatedCompanies } },
      { upsert: true, new: true } // Options to upsert and return the new document
    );

    res.json({
      message: 'Footer updated successfully',
      result,
    });
  } catch (error) {
    console.error('Failed to update footer config:', error);
    res.status(500).send('Server error');
  }
};

// Controller to get footer configuration
export const getFooterData = async (req, res) => {
  try {
    // Attempt to find the footer configuration document in the database
    const footerConfig = await FooterConfig.findOne(); // Assuming there's only one footer config document

    // If a footer configuration exists, return it
    if (footerConfig) {
      res.json(footerConfig);
    } else {
      // If not found, you might want to return a default configuration or a not found error
      res.status(404).json({ message: 'Footer data not found' });
    }
  } catch (error) {
    console.error('Failed to fetch footer data:', error);
    res.status(500).send('Server error');
  }
};
