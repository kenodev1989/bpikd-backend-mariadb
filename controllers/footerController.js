import multer from "multer";
import fs from "fs";
import path from "path";
import pool from "../db/config.js";

const storage = multer.diskStorage({
  destination: "./public/uploads/footer",
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
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
  const filetypes = /jpeg|jpg|png|gif|/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: Files Only!");
  }
}

export const uploadMiddleware = upload.fields([
  { name: "companyImage-0" },
  { name: "companyImage-1" },
  { name: "companyImage-2" },
  { name: "companyImage-3" },
  { name: "companyImage-4" },
]);

export const updateFooterConfig = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const currentDataResult = await conn.query(
      "SELECT companies FROM footer_config WHERE id = 1"
    );
    if (
      currentDataResult[0] &&
      typeof currentDataResult[0].companies === "string"
    ) {
      let currentData = JSON.parse(currentDataResult[0].companies);
    } else {
      console.log("No or invalid companies data:", currentDataResult[0]);
      let currentData = [];
    }

    if (!req.body.companies) {
      throw new Error('Invalid or missing "companies" data');
    }

    let companiesData = JSON.parse(req.body.companies);
    if (!Array.isArray(companiesData)) {
      companiesData = [companiesData];
    }

    const newData = companiesData.map((updatedCompany, index) => {
      const file = req.files[`companyImage-${index}`]
        ? req.files[`companyImage-${index}`][0]
        : null;
      if (file) {
        updatedCompany.src = `${req.protocol}://${req.get(
          "host"
        )}/uploads/footer/${file.filename}`;
      } else if (updatedCompany.src && updatedCompany.src.startsWith("blob:")) {
        updatedCompany.src = updatedCompany.src.replace("blob:", "");
      }
      return updatedCompany;
    });

    const companiesJson = JSON.stringify(newData);
    await conn.query(
      "INSERT INTO footer_config (id, companies) VALUES (1, ?) ON DUPLICATE KEY UPDATE companies = ?",
      [companiesJson, companiesJson]
    );

    res.json({
      message: "Footer configuration updated successfully",
      data: newData,
    });
  } catch (error) {
    console.error("Failed to update footer configuration:", error);
    res.status(500).send("Server error: " + error.message);
  } finally {
    if (conn) conn.release();
  }
};

export const getFooterData = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [footerConfig] = await conn.query(
      "SELECT * FROM footer_config LIMIT 1"
    );

    if (footerConfig) {
      // Assuming footerConfig.companies is stored as a JSON string
      footerConfig.companies = JSON.parse(footerConfig.companies);
      res.json(footerConfig);
    } else {
      res.status(404).json({ message: "Footer data not found" });
    }
  } catch (error) {
    console.error("Failed to fetch footer data:", error);
    res.status(500).send("Server error");
  } finally {
    if (conn) conn.release();
  }
};
