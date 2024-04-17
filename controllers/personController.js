import moment from "moment-timezone";
import pool from "../db/config.js";

function serializeBigInt(key, value) {
  if (typeof value === "bigint") {
    return value.toString(); // convert BigInt to string
  } else {
    return value; // return everything else unchanged
  }
}

export const addOrUpdatePersonAndWork = async (req, res) => {
  let conn;
  try {
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

    conn = await pool.getConnection();
    await conn.beginTransaction();

    let featuredImage =
      req.files && req.files.featuredImage && req.files.featuredImage[0]
        ? `${req.protocol}://${req.get("host")}/uploads/${
            req.files.featuredImage[0].filename
          }`
        : null;

    // Attempt to find existing person
    const [existing] = await conn.query(
      "SELECT id FROM persons WHERE firstName = ? AND lastName = ?",
      [personData.firstName, personData.lastName]
    );

    let personId = existing && existing.length ? existing[0].id : null;

    if (!personId) {
      // Insert new person if not found
      const result = await conn.query(
        "INSERT INTO persons (firstName, lastName, aboutPerson, featured, createdBy, category, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          personData.firstName,
          personData.lastName,
          personData.aboutPerson,
          featuredImage || null,
          "admin", // Example placeholder
          category,
          visibility,
        ]
      );
      personId = result.insertId;
    }

    // Insert new work related to the person
    const workResult = await conn.query(
      "INSERT INTO works (person_id, title, content, publishTime, scheduledPublishTime, externalSource, visibility, isPublished, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        personId,
        title,
        content,
        publishTime,
        scheduledPublishTime || null,
        externalSource || null,
        visibility,
        isPublished,
        "admin",
      ]
    );
    const workId = workResult.insertId;

    // Handle media files
    const mediaTypes = ["images", "videos", "audios", "documents"];
    for (const type of mediaTypes) {
      if (req.files && req.files[type]) {
        for (const file of req.files[type]) {
          const filePath = `${req.protocol}://${req.get("host")}/uploads/${
            file.filename
          }`;
          await conn.query(
            "INSERT INTO media (work_id, url, name, fileType) VALUES (?, ?, ?, ?)",
            [workId, filePath, file.originalname, file.mimetype]
          );
        }
      }
    }

    await conn.commit();
    res.json({
      message: "Person and work added/updated successfully",
      personId, // Use custom serializer for BigInt
    });
  } catch (error) {
    await conn.rollback(); // Rollback the transaction on error
    console.error("Failed to add/update person and work:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  } finally {
    if (conn) {
      conn.release(); // Ensure the connection is always released
    }
  }
};

export const getAllPersonsWithData = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
            SELECT 
                p.id as person_id,
                p.firstName,
                p.lastName,
                p.aboutPerson,
                p.featured,
                p.createdBy,
                p.created_at,
                w.id as work_id,
                w.title,
                w.content,
                w.publishTime,
                w.isPublished,
                w.scheduledPublishTime,
                w.externalSource,
                m.id as media_id,
                m.url,
                m.name,
                m.fileType
            FROM 
                persons p
            LEFT JOIN 
                works w ON p.id = w.person_id
            LEFT JOIN 
                media m ON w.id = m.work_id;
        `;
    const rows = await conn.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Failed to retrieve persons:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

export const getPersonBasics = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
            SELECT
                id,
                firstName,
                lastName,
                featured
            FROM 
                persons;
        `;
    const rows = await conn.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Failed to retrieve person basics:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

export async function deletePerson(req, res) {
  let conn;
  try {
    const { personId } = req.params; // Assuming the person ID to delete is passed as a URL parameter (e.g., /persons/:personId)

    conn = await pool.getConnection();
    const result = await conn.query("DELETE FROM persons WHERE id = ?", [
      personId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Person not found." });
    }

    // Person deleted successfully
    res.json({ message: "Person deleted successfully." });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while deleting the person." });
  } finally {
    if (conn) {
      conn.release();
    }
  }
}

export async function deleteMultiplePersons(req, res) {
  let conn;
  try {
    const { personIds } = req.body; // The request should contain an array of person IDs to be deleted

    conn = await pool.getConnection();
    const result = await conn.query("DELETE FROM persons WHERE id IN (?)", [
      personIds,
    ]);

    // Respond with success message
    // result.affectedRows tells you how many documents were deleted
    res.json({
      message: `${result.affectedRows} persons have been successfully deleted.`,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while deleting persons." });
  } finally {
    if (conn) {
      conn.release();
    }
  }
}
