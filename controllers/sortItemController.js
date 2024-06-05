import pool from '../db/config.js'; // Assumes you have a dbConnection module for pooling

function replacer(key, value) {
  if (typeof value === 'bigint') {
    return value.toString(); // Convert BigInt to string
  }
  return value;
}

export const updateOrCreateSortItems = async (req, res) => {
  const { firstRowItems, secondRowItems, userId } = req.body;

  if (!firstRowItems || !secondRowItems || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Insert or update logic for firstRowItem
    let [existingSortItem] = await connection.query(
      'SELECT id FROM sort_items WHERE userId = ? AND firstRowItem = ?',
      [userId, firstRowItems.id]
    );

    let sortItemId;

    if (existingSortItem) {
      sortItemId = existingSortItem.id;
      console.log('Using existing sort item ID:', sortItemId);
    } else {
      let result = await connection.query(
        'INSERT INTO sort_items (userId, firstRowItem) VALUES (?, ?)',
        [userId, firstRowItems.id]
      );
      sortItemId = result.insertId;
      console.log('New sort item created with ID:', sortItemId);
    }

    // Handling secondRowItems
    await connection.query(
      'DELETE FROM second_row_items WHERE sortItem_id = ?',
      [sortItemId]
    );

    for (const item of secondRowItems) {
      await connection.query(
        'INSERT INTO second_row_items (sortItem_id, personId) VALUES (?, ?)',
        [sortItemId, item.id]
      );
    }

    await connection.commit();
    res.json({ message: 'Sort items updated successfully', id: sortItemId });
  } catch (error) {
    await connection.rollback();
    console.error('Error processing your request:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (connection) connection.release();
  }
};

/* export const updateSortedItems = async (req, res) => {
  const { firstRowItems, secondRowItems } = req.body;

  const userId = 1;

  // Check if firstRowItems is undefined, null, or an empty object
  if (!firstRowItems || Object.keys(firstRowItems).length === 0) {
    return res
      .status(400)
      .json({ error: 'firstRowItems is required and cannot be empty.' });
  }

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Handling firstRowItem
    // Check if an entry exists for this user
    let [existing] = await conn.query(
      'SELECT id FROM sort_items WHERE userId = ?',
      [userId]
    );

    if (existing) {
      // Update existing firstRowItem
      await conn.query(
        'UPDATE sort_items SET firstRowItem = ? WHERE userId = ?',
        [firstRowItems.id, userId]
      );
    } else {
      // Insert new firstRowItem if none exists
      await conn.query(
        'INSERT INTO sort_items (userId, firstRowItem) VALUES (?, ?)',
        [userId, firstRowItems.id]
      );
    }

    // Handling secondRowItems
    // First, delete existing secondRowItems for this user
    let sortItemId = existing
      ? existing.id
      : (await conn.query('SELECT LAST_INSERT_ID() AS id')).id;
    await conn.query('DELETE FROM second_row_items WHERE sortItem_id = ?', [
      sortItemId,
    ]);

    // Now, insert the new secondRowItems
    for (const item of secondRowItems) {
      await conn.query(
        'INSERT INTO second_row_items (sortItem_id, personId, placeholder, text) VALUES (?, ?, ?, ?)',
        [sortItemId, item.id, item.placeholder, item.text]
      );
    }

    await conn.commit();
    res.json({ message: 'Sorted items updated successfully' });
  } catch (error) {
    await conn.rollback();
    console.error('Error processing your request:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) conn.release();
  }
}; */

export const updateSortedItems = async (req, res) => {
  const { firstRowItems, secondRowItems } = req.body;
  const userId = 1;

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Check if an entry exists for this user
    let [existing] = await conn.query(
      'SELECT id FROM sort_items WHERE userId = ?',
      [userId]
    );

    if (firstRowItems === null) {
      if (existing) {
        await conn.query(
          'UPDATE sort_items SET firstRowItem = NULL WHERE userId = ?',
          [userId]
        );
      }
    } else if (firstRowItems && Object.keys(firstRowItems).length > 0) {
      if (existing) {
        await conn.query(
          'UPDATE sort_items SET firstRowItem = ? WHERE userId = ?',
          [firstRowItems.id, userId]
        );
      } else {
        await conn.query(
          'INSERT INTO sort_items (userId, firstRowItem) VALUES (?, ?)',
          [userId, firstRowItems.id]
        );
      }
    }

    let sortItemId = existing
      ? existing.id
      : (await conn.query('SELECT LAST_INSERT_ID() AS id'))[0].id;

    // Delete existing secondRowItems for this user
    await conn.query('DELETE FROM second_row_items WHERE sortItem_id = ?', [
      sortItemId,
    ]);

    // Insert new secondRowItems
    for (const item of secondRowItems) {
      if (item.placeholder) {
        // Handling placeholders
        await conn.query(
          'INSERT INTO second_row_items (sortItem_id, personId, placeholder, text) VALUES (?, NULL, ?, ?)',
          [sortItemId, item.placeholder, item.text]
        );
      } else {
        // Handling real person items
        await conn.query(
          'INSERT INTO second_row_items (sortItem_id, personId, placeholder, text) VALUES (?, ?, FALSE, ?)',
          [sortItemId, item.id, item.text]
        );
      }
    }

    await conn.commit();
    res.json({ message: 'Sorted items updated successfully' });
  } catch (error) {
    await conn.rollback();
    console.error('Error processing your request:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) conn.release();
  }
};

/* export const getAllSortedItems = async (req, res) => {
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
      userId: rows[0]?.userId ? String(rows[0].userId) : null,
    };

    rows.forEach((row) => {
      if (row.firstRowPersonId) {
        response.firstRowItems = {
          id: String(row.firstRowPersonId),
          firstName: row.firstRowFirstName,
          lastName: row.firstRowLastName,
          featured: row.firstRowFeatured,
        };
      }
      if (row.secondRowPersonId) {
        response.secondRowItems.push({
          id: String(row.secondRowPersonId),
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
}; */

export const getAllSortedItems = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const results = await conn.query(`
        SELECT 
        si.id AS sortItemId, 
        si.firstRowItem AS firstRowPersonId, 
        p.firstName AS firstRowFirstName, 
        p.lastName AS firstRowLastName, 
        p.featured AS firstRowFeatured,
        sp.id AS secondRowPersonId, 
        sp.firstName AS secondRowFirstName, 
        sp.lastName AS secondRowLastName, 
        sp.featured AS secondRowFeatured,
        sr.placeholder AS secondRowPlaceholder
        FROM sort_items si
        LEFT JOIN persons p ON si.firstRowItem = p.id
        LEFT JOIN second_row_items sr ON si.id = sr.sortItem_id
        LEFT JOIN persons sp ON sr.personId = sp.id;
    `);

    const rows = Array.isArray(results) ? results : [results];

    const response = {
      firstRowItems: {},
      secondRowItems: [],
      userId: rows[0]?.userId ? String(rows[0].userId) : null,
    };

    rows.forEach((row) => {
      if (row.firstRowPersonId && !response.firstRowItems.id) {
        response.firstRowItems = {
          id: String(row.firstRowPersonId),
          firstName: row.firstRowFirstName,
          lastName: row.firstRowLastName,
          featured: row.firstRowFeatured || '/assets/no-picture.png',
        };
      }
      if (row.secondRowPersonId || row.secondRowPlaceholder) {
        response.secondRowItems.push({
          id: row.secondRowPersonId ? String(row.secondRowPersonId) : null,
          firstName: row.secondRowFirstName,
          lastName: row.secondRowLastName,
          featured: row.secondRowFeatured || '/assets/no-picture.png',
          placeholder: row.secondRowPlaceholder,
        });
      }
    });

    res.json(response);
  } catch (error) {
    console.error('Failed to retrieve sorted items:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) conn.release();
  }
};
