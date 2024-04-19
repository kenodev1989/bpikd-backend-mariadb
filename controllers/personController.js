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

    // Improved debug statement to clarify what's retrieved
    const [existing] = await conn.query(
      "SELECT id FROM persons WHERE firstName = ? AND lastName = ?",
      [personData.firstName, personData.lastName]
    );
    console.log("Existing person check:", existing);

    let personId = existing ? existing.id : null;
    /* let personId = existing && existing.length > 0 ? existing.id : null; */
    console.log("Determined person ID:", existing); // Additional debug information

    if (personId) {
      console.log("Using existing person ID:", personId); // This should appear if a person is found
      if (featuredImage) {
        await conn.query("UPDATE persons SET featured = ? WHERE id = ?", [
          featuredImage,
          personId,
        ]);
      }
    } else {
      console.log("No existing person found, inserting new person"); // Confirm this logic branch
      const result = await conn.query(
        "INSERT INTO persons (firstName, lastName, aboutPerson, featured, createdBy, category, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          personData.firstName,
          personData.lastName,
          personData.aboutPerson,
          featuredImage,
          "admin",
          category,
          visibility,
        ]
      );
      personId = result.insertId;
      console.log("New person inserted with ID:", personId); // Log new person ID
    }

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
    console.log("Work added with ID:", workId);

    /*  ["images", "videos", "audios", "documents"].forEach((type) => {
      if (req.files && req.files[type]) {
        for (const file of req.files[type]) {
          const filePath = `${req.protocol}://${req.get("host")}/uploads/${
            file.filename
          }`;
          conn.query(
            "INSERT INTO media (work_id, url, name, fileType) VALUES (?, ?, ?, ?)",
            [workId, filePath, file.originalname, file.mimetype]
          );
        }
      }
    }); */

    let media = { images: [], videos: [], audios: [], documents: [] };
    ["images", "videos", "audios", "documents"].forEach((type) => {
      if (req.files && req.files[type]) {
        req.files[type].forEach((file) => {
          const filePath = `${req.protocol}://${req.get("host")}/uploads/${
            file.filename
          }`;
          media[type].push({
            url: filePath,
            name: file.originalname,
            fileType: file.mimetype,
            type,
          });
          // Insert each media file into the database
          conn.query(
            "INSERT INTO media (work_id, url, name, fileType, type) VALUES (?, ?, ?, ?, ?)",
            [workId, filePath, file.originalname, file.mimetype, type]
          );
        });
      }
    });

    await conn.commit();
    res.json({
      message: "Person and work added/updated successfully",
      personId: personId.toString(), // Handle BigInt correctly
      workId: workId.toString(),
    });
  } catch (error) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error("Failed to add/update person and work:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  } finally {
    if (conn) {
      conn.release();
      console.log("Connection released.");
    }
  }
};

export const searchPersonsByPartialName = async (req, res) => {
  const { searchQuery } = req.query;

  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      SELECT id, firstName, lastName, featured
      FROM persons
      WHERE firstName LIKE CONCAT('%', ?, '%') OR lastName LIKE CONCAT('%', ?, '%');
    `;

    const results = await conn.query(query, [searchQuery, searchQuery]);

    if (!results) {
      res.status(404).json({ message: "No users found." });
      return;
    }

    // Ensure that results is an array before trying to map over it
    if (Array.isArray(results)) {
      const users = results.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        featured: user.featured,
      }));
      res.json(users);
    } else {
      res.status(500).json({ message: "Error processing results." });
    }
  } catch (error) {
    console.error("Search users by partial name error:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  } finally {
    if (conn) {
      conn.release();
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

export const deleteMultiplePersons = async (req, res) => {
  const { personIds } = req.body; // Expect an array of person IDs
  console.log("Received person IDs for deletion:", personIds);

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction(); // Start transaction

    // Log the query for debugging
    console.log("Deleting works for persons IDs:", personIds);
    await conn.query("DELETE FROM works WHERE person_id IN (?)", [personIds]);

    // Log the query for debugging
    console.log("Deleting persons with IDs:", personIds);
    const result = await conn.query("DELETE FROM persons WHERE id IN (?)", [
      personIds,
    ]);

    await conn.commit(); // Commit the transaction
    console.log(`Deleted ${result.affectedRows} persons successfully.`);
    res.json({
      message: `${result.affectedRows} persons and their works have been successfully deleted.`,
    });
  } catch (error) {
    await conn.rollback(); // Rollback on error
    console.error("Failed to delete multiple persons:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  } finally {
    if (conn) {
      conn.release(); // Always release connection
    }
  }
};

export const getPersonWithWorksAndMedia = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    // Query to get all persons, their works, and media. Adjust table and column names as necessary.
    const query = `
            SELECT p.id as personId, p.firstName, p.lastName, p.aboutPerson, w.id as workId, w.title, w.content, w.publishTime, w.isPublished, w.scheduledPublishTime, w.externalSource,
                   m.id as mediaId, m.url, m.name as mediaName, m.fileType, m.type as mediaType
            FROM persons p
            LEFT JOIN works w ON p.id = w.person_id
            LEFT JOIN media m ON w.id = m.work_id
            ORDER BY p.id, w.id, m.id;
        `;

    const results = await conn.query(query);
    conn.release(); // Always release connection

    // Process the flat SQL results into nested JSON format
    const personsMap = new Map();

    results.forEach((row) => {
      if (!personsMap.has(row.personId)) {
        personsMap.set(row.personId, {
          id: row.personId,
          firstName: row.firstName,
          lastName: row.lastName,
          aboutPerson: row.aboutPerson,
          works: [],
        });
      }

      const person = personsMap.get(row.personId);
      let work = person.works.find((w) => w.id === row.workId);

      if (!work) {
        work = {
          id: row.workId,
          title: row.title,
          content: row.content,
          publishTime: row.publishTime,
          isPublished: row.isPublished,
          scheduledPublishTime: row.scheduledPublishTime,
          externalSource: row.externalSource,
          media: [],
        };
        person.works.push(work);
      }

      if (row.mediaId) {
        const mediaItem = {
          id: row.mediaId,
          url: row.url,
          name: row.mediaName,
          fileType: row.fileType,
          type: row.mediaType,
        };
        work.media.push(mediaItem);
      }
    });

    // Convert Map to array
    const persons = Array.from(personsMap.values());

    res.json(persons);
  } catch (error) {
    console.error("Failed to retrieve person data:", error);
    if (conn) conn.release();
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

export const getPersonWithWorksAndMediaById = async (req, res) => {
  const { personId } = req.params; // assuming person ID is sent as a URL parameter

  let conn;
  try {
    conn = await pool.getConnection();

    // Query to fetch person details, works, and associated media
    const query = `
            SELECT p.id AS personId, p.firstName, p.lastName, p.aboutPerson, p.featured,
                   w.id AS workId, w.title, w.content, w.publishTime, w.isPublished, w.scheduledPublishTime, w.externalSource,
                   m.id AS mediaId, m.url, m.name AS mediaName, m.fileType, m.type
            FROM persons p
            LEFT JOIN works w ON p.id = w.person_id
            LEFT JOIN media m ON w.id = m.work_id
            WHERE p.id = ?
            ORDER BY w.id, m.id;
        `;

    const rows = await conn.query(query, [personId]);

    // Formatting the response to include media sorted by type under each work
    let response = {
      personId: personId,
      firstName: rows[0]?.firstName,
      lastName: rows[0]?.lastName,
      aboutPerson: rows[0]?.aboutPerson,
      featured: rows[0]?.featured,
      works: [],
    };

    let currentWorkId = null;
    let work = {};

    rows.forEach((row) => {
      if (currentWorkId !== row.workId) {
        if (currentWorkId !== null) {
          response.works.push(work);
        }
        currentWorkId = row.workId;
        work = {
          workId: row.workId,
          title: row.title,
          content: row.content,
          publishTime: row.publishTime,
          isPublished: row.isPublished,
          scheduledPublishTime: row.scheduledPublishTime,
          externalSource: row.externalSource,
          media: { images: [], videos: [], audios: [], documents: [] },
        };
      }
      if (row.mediaId) {
        work.media[row.type].push({
          mediaId: row.mediaId,
          url: row.url,
          name: row.mediaName,
          fileType: row.fileType,
        });
      }
    });
    if (work.workId) {
      response.works.push(work);
    }

    res.json(response);
  } catch (error) {
    console.error("Failed to retrieve person with works and media:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  } finally {
    if (conn) conn.release();
  }
};
