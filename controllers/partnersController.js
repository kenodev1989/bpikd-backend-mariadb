import pool from "../db/config";

export const updateCreatePartners = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const companiesData = JSON.parse(req.body.companies || "[]");

    const results = await Promise.all(
      companiesData.map(async (company, index) => {
        const file = req.files[`companyImage-${index}`]
          ? req.files[`companyImage-${index}`][0]
          : null;
        let filePath = company.src;

        if (file) {
          // New file uploaded, update the path
          filePath = `${req.protocol}://${req.get("host")}/uploads/footer/${
            file.filename
          }`;
          // Overwrite logic: remove old file if new one uploaded
          fs.unlinkSync(
            `./public/uploads/footer/${company.src.split("/").pop()}`
          );
        } else if (company.id) {
          // No new file uploaded, attempt to reuse existing path
          const [existing] = await conn.query(
            "SELECT src FROM footer_companies WHERE id = ?",
            [company.id]
          );
          filePath = existing.length > 0 ? existing[0].src : filePath;
        }

        if (company.id) {
          // Update existing record
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
          // Insert new record
          const result = await conn.query(
            "INSERT INTO footer_companies (company, description, url, src) VALUES (?, ?, ?, ?)",
            [company.company, company.description, company.url, filePath]
          );
          company.id = result.insertId;
        }

        return { ...company, src: filePath };
      })
    );

    res.json({
      message: "Footer configuration updated successfully",
      data: results,
    });
  } catch (error) {
    console.error("Failed to update footer configuration:", error);
    res.status(500).send("Server error: " + error.message);
  } finally {
    if (conn) {
      conn.release();
    }
  }
};
