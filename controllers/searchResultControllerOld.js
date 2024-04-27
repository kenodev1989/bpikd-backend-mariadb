import pool from '../db/config.js';

export const searchItems = async (req, res) => {
  const {
    words: searchTerm,
    phrase,
    anyWords,
    excludeWords,
    externalSources,
    category,
    createdStartDate,
    createdEndDate,
    publishStartDate,
    publishEndDate,
    page = 1,
    limit = 10,
  } = req.body.query;

  console.log('Received query:', req.body.query);

  try {
    const tables = ['news', 'about', 'soon', 'works', 'persons'];
    let sqlParts = [];
    let countParts = [];
    const params = [];
    const countParams = [];

    tables.forEach((table) => {
      let queryPart = '';
      let countPart = '';
      // Customize SQL based on the table structure
      if (table === 'persons') {
        queryPart = `(SELECT 'persons' AS source_table, id, CONCAT(firstName, ' ', lastName) AS title, aboutPerson AS content, createdBy, created_at, externalSource FROM persons WHERE 1=1`;
      } else if (table === 'works') {
        queryPart = `(SELECT 'works' AS source_table, person_id, title, content, createdBy, created_at, externalSource FROM works WHERE 1=1`;
      } else {
        queryPart = `(SELECT '${table}' AS source_table, id, title, content, createdBy, created_at, externalSource FROM ${table} WHERE 1=1`;
      }

      // Copy the setup for queryPart, modify as needed for counting
      countPart = `(SELECT COUNT(*) FROM ${table} WHERE 1=1`;

      // Handling various text-based search criteria
      /* if (searchTerm) {
        let searchTerms = Array.isArray(searchTerm) ? searchTerm : [searchTerm];
        searchTerms.forEach((term) => {
          const likeClause =
            table === 'persons'
              ? `(firstName LIKE ? OR lastName LIKE ?)`
              : `(title LIKE ? OR content LIKE ?)`;
          queryPart += ' AND ' + likeClause;
          params.push(`%${term.trim()}%`, `%${term.trim()}%`);
          countParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
        });
      } */

      if (searchTerm) {
        let words = Array.isArray(searchTerm) ? searchTerm : [searchTerm];
        words.forEach((term) => {
          const fields =
            table === 'persons'
              ? `(firstName LIKE ? OR lastName LIKE ?)`
              : `(title LIKE ? OR content LIKE ?)`;
          queryPart += ' AND ' + fields;
          countPart += ' AND ' + fields;
          params.push(`%${term}%`, `%${term}%`);
          countParams.push(`%${term}%`, `%${term}%`);
        });
      }

      if (phrase) {
        const fields =
          table === 'persons'
            ? `(firstName LIKE ? OR lastName LIKE ?)`
            : `(title LIKE ? OR content LIKE ?)`;
        queryPart += ' AND ' + fields;
        countPart += ' AND ' + fields;
        params.push(`%${phrase}%`, `%${phrase}%`);
        countParams.push(`%${phrase}%`, `%${phrase}%`);
      }

      if (anyWords && anyWords.length > 0) {
        queryPart +=
          ' AND (' +
          anyWords
            .map((word) => `(title LIKE ? OR content LIKE ?)`)
            .join(' OR ') +
          ')';
        anyWords.forEach((word) =>
          params.push(`%${word.trim()}%`, `%${word.trim()}%`)
        );
      }

      if (excludeWords && table !== 'persons') {
        excludeWords.forEach((word) => {
          queryPart += ' AND title NOT LIKE ? AND content NOT LIKE ?';
          params.push(`%${word.trim()}%`, `%${word.trim()}%`);
        });
      }

      if (category) {
        queryPart += ` AND category = ?`;
        params.push(category);
      }

      if (externalSources === 'true' && table !== 'persons') {
        queryPart += ' AND externalSource IS NOT NULL AND externalSource <> ""';
      }

      // Date range filters
      if (createdStartDate) {
        queryPart += ' AND created_at >= ?';
        params.push(createdStartDate);
      }

      if (createdEndDate) {
        queryPart += ' AND created_at <= ?';
        params.push(createdEndDate);
      }

      if (publishStartDate) {
        queryPart += ' AND publishTime >= ?';
        params.push(publishStartDate);
      }

      if (publishEndDate) {
        queryPart += ' AND publishTime <= ?';
        params.push(publishEndDate);
      }

      queryPart += ')';
      sqlParts.push(queryPart);
    });

    const fullSql = sqlParts.join(' UNION ALL ') + ' LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);

    const results = await pool.query(fullSql, params);
    const totalResults = results.length;

    const pages = Math.ceil(totalResults / limit);

    res.json({ data: results, totalResults, pages });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).send('Error during search');
  }
};
