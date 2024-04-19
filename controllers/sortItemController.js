import pool from "../db/config.js"; // Assumes you have a dbConnection module for pooling

export const updateOrCreateSortItems = async (req, res) => {
  const { firstRowItems, secondRowItems, userId } = req.body;

  if (!firstRowItems || !secondRowItems || !userId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Insert or update logic for firstRowItem
    let [existingSortItem] = await connection.query(
      "SELECT id FROM sort_items WHERE userId = ? AND firstRowItem = ?",
      [userId, firstRowItems.id]
    );

    let sortItemId;

    if (existingSortItem) {
      sortItemId = existingSortItem[0].id;
      console.log("Using existing sort item ID:", sortItemId);
    } else {
      let result = await connection.query(
        "INSERT INTO sort_items (userId, firstRowItem) VALUES (?, ?)",
        [userId, firstRowItems.id]
      );
      sortItemId = result.insertId;
      console.log("New sort item created with ID:", sortItemId);
    }

    // Handling secondRowItems
    await connection.query(
      "DELETE FROM second_row_items WHERE sortItem_id = ?",
      [sortItemId]
    );

    for (const item of secondRowItems) {
      await connection.query(
        "INSERT INTO second_row_items (sortItem_id, personId) VALUES (?, ?)",
        [sortItemId, item.id]
      );
    }

    await connection.commit();
    res.json({ message: "Sort items updated successfully", id: sortItemId });
  } catch (error) {
    await connection.rollback();
    console.error("Error processing your request:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};
export const getAllSortedItems = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
            SELECT 
                si.id AS sortItemId, si.userId,
                p.id AS firstRowPersonId, p.firstName AS firstRowFirstName, 
                p.lastName AS firstRowLastName, p.featured AS firstRowFeatured,
                sr.personId AS secondRowPersonId, sp.firstName AS secondRowFirstName, 
                sp.lastName AS secondRowLastName, sp.featured AS secondRowFeatured
            FROM sort_items si
            JOIN persons p ON si.firstRowItem = p.id
            LEFT JOIN second_row_items sr ON si.id = sr.sortItem_id
            LEFT JOIN persons sp ON sr.personId = sp.id
        `;
    const results = await conn.query(query);
    const rows = Array.isArray(results) ? results : [results];

    const response = {
      firstRowItems: {},
      secondRowItems: [],
      userId: rows[0]?.userId || null,
    };

    rows.forEach((row) => {
      if (row.firstRowPersonId) {
        response.firstRowItems = {
          id: row.firstRowPersonId,
          firstName: row.firstRowFirstName,
          lastName: row.firstRowLastName,
          featured: row.firstRowFeatured,
        };
      }
      if (row.secondRowPersonId) {
        response.secondRowItems.push({
          id: row.secondRowPersonId,
          firstName: row.secondRowFirstName,
          lastName: row.secondRowLastName,
          featured: row.secondRowFeatured,
        });
      }
    });

    res.json(response);
  } catch (error) {
    console.error("Failed to retrieve sorted items:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  } finally {
    if (conn) conn.release();
  }
};
