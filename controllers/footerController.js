import multer from "multer";
import fs from "fs";
import path from "path";
import pool from "../db/config.js";

/* const storage = multer.diskStorage({
  destination: "./public/uploads/footer",
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
}); */

const storage = multer.diskStorage({
  destination: "./public/uploads/footer",
  filename: function (req, file, cb) {
    // Extract index from the fieldname which is assumed to be like companyImage-0, companyImage-1, etc.
    const match = file.fieldname.match(/companyImage-(\d+)/);
    const index = match ? match[1] : "default";
    const fileExtension = path.extname(file.originalname);

    // This filename will be consistent for the same field, causing new uploads to overwrite older ones
    const filename = `companyImage-${index}${fileExtension}`;
    cb(null, filename);
  },
});

// Existing Multer configuration
export const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit the file size
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const isFileTypeAllowed =
      filetypes.test(path.extname(file.originalname).toLowerCase()) &&
      filetypes.test(file.mimetype);
    if (isFileTypeAllowed) {
      cb(null, true);
    } else {
      // Call callback with an error message
      cb(new Error("Only images are allowed! (JPEG, JPG, PNG, GIF)"));
    }
  },
}).fields([
  { name: "companyImage-0" },
  { name: "companyImage-1" },
  { name: "companyImage-2" },
  { name: "companyImage-3" },
  { name: "companyImage-4" },
]);

/* 
export const uploadMiddleware = upload.fields([
  { name: "companyImage-0" },
  { name: "companyImage-1" },
  { name: "companyImage-2" },
  { name: "companyImage-3" },
  { name: "companyImage-4" },
]); */

function replacer(key, value) {
  if (typeof value === "bigint") {
    return value.toString(); // convert BigInt to string
  } else {
    return value;
  }
}

export const updateFooterConfig = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const companiesData = JSON.parse(req.body.companies || "[]"); // Safely parse the JSON input

    const results = await Promise.all(
      companiesData.map(async (company, index) => {
        const file = req.files[`companyImage-${index}`]
          ? req.files[`companyImage-${index}`][0]
          : null;
        let filePath = company.src;

        if (file) {
          // If a new file is uploaded, update the file path
          filePath = `${req.protocol}://${req.get("host")}/uploads/footer/${
            file.filename
          }`;
        } else if (company.id) {
          // If no new file and id exists, attempt to reuse the existing file path
          const [existing] = await conn.query(
            "SELECT src FROM footer_companies WHERE id = ?",
            [company.id]
          );
          if (existing.length > 0) {
            filePath = existing[0].src;
          }
        }

        if (company.id) {
          // Update existing company info
          await conn.query(
            "UPDATE footer_companies SET company = ?, description = ?, url = ?, src = ? WHERE id = ?",
            [
              company.company,
              company.description,
              company.url,
              filePath,
              company.id,
            ]
          );
        } else {
          // Insert new company info
          const result = await conn.query(
            "INSERT INTO footer_companies (company, description, url, src) VALUES (?, ?, ?, ?)",
            [company.company, company.description, company.url, filePath]
          );
          company.id = result.insertId; // Update company id with new ID from database
        }
        return { ...company, src: filePath }; // Return the updated company info
      })
    );

    // Use a replacer function to handle BigInt serialization in JSON
    function replacer(key, value) {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    }

    res.json({
      message: "Footer configuration updated successfully",
      data: results,
    });
  } catch (error) {
    console.error("Failed to update footer configuration:", error);
    res.status(500).send("Server error: " + error.message);
  } finally {
    if (conn) {
      conn.release(); // Always release connection
    }
  }
};

export const getFooterData = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const results = await conn.query("SELECT * FROM footer_companies"); // Get all companies

    if (results.length > 0) {
      // Process results into a more friendly format if necessary
      const companies = results.map((company) => ({
        id: company.id,
        company: company.company,
        description: company.description,
        url: company.url,
        src: company.src,
        last_updated: company.last_updated,
      }));

      // Send all companies as part of a footerConfig object
      res.json({
        message: "Footer data fetched successfully",
        footerCompanies: companies,
      });
    } else {
      res.status(404).json({ message: "Footer data not found" });
    }
  } catch (error) {
    console.error("Failed to fetch footer data:", error);
    res.status(500).send("Server error: " + error.message);
  } finally {
    if (conn) {
      conn.release(); // Ensure connection is always released
    }
  }
};
