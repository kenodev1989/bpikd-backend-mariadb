import pool from '../db/config.js';

export const searchItems = async (req, res) => {
  const {
    sort,
    words: searchTerm,
    phrase,
    anyWords,
    excludeWords,
    includeExternalSources: externalSources,
    categories,
    createdStartDate,
    createdEndDate,
    publishStartDate,
    publishEndDate,
    page = 1,
    limit = 10,
  } = req.body.query;

  console.log('Received query:', req.body.query);

  try {
    const tables = ['news', 'works', 'persons', 'soon'];
    let sqlParts = [];
    let countParts = [];
    const params = [];
    const countParams = [];

    tables.forEach((table) => {
      let queryPart = '';
      let countPart = '';
      // Customize SQL based on the table structure
      if (table === 'persons') {
        queryPart = `(SELECT 'persons' AS source_table, id, CONCAT(firstName, ' ', lastName) AS title, aboutPerson AS content, createdBy, created_at, externalSource, category FROM persons WHERE 1=1`;
      } else if (table === 'works') {
        // Join the persons table to get firstName and lastName for each work
        queryPart = `(SELECT 'works' AS source_table, CONCAT(persons.firstName, ' ', persons.lastName) AS person_id, works.title, works.content, works.createdBy, works.created_at, works.externalSource, works.category 
                FROM works 
                JOIN persons ON works.person_id = persons.id WHERE 1=1`;
      } else {
        queryPart = `(SELECT '${table}' AS source_table, id, title, content, createdBy, created_at, externalSource, category FROM ${table} WHERE 1=1`;
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
        if (words.length > 0) {
          queryPart += ' AND ('; // Start the group of OR conditions
          countPart += ' AND (';

          words.forEach((term, index) => {
            const fields =
              table === 'persons'
                ? `(firstName LIKE ? OR lastName LIKE ?)`
                : `(title LIKE ? OR content LIKE ?)`;

            if (index > 0) {
              // Add OR only if it's not the first term
              queryPart += ' OR ';
              countPart += ' OR ';
            }

            queryPart += fields;
            countPart += fields;
            params.push(`%${term.trim()}%`, `%${term.trim()}%`);
            countParams.push(`%${term.trim()}%`, `%${term.trim()}%`);
          });

          queryPart += ')'; // Close the group of OR conditions
          countPart += ')';
        }
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
        // Start the condition string with opening parenthesis for the OR conditions
        queryPart += ' AND (';

        // Map over each word to create an SQL condition for it
        const conditions = anyWords
          .map((word) => {
            // Ensure word is trimmed and non-empty
            word = word.trim();
            if (word) {
              // Push the parameters for each condition into the params array twice, once for title and once for content
              params.push(`%${word}%`, `%${word}%`);
              // Return the SQL condition part for this word

              const fields =
                table === 'persons'
                  ? `(firstName LIKE ? OR lastName LIKE ?)`
                  : `(title LIKE ? OR content LIKE ?)`;
              return fields;
            }
            return null;
          })
          .filter((condition) => condition !== null) // Filter out any null conditions if empty words were present
          .join(' OR '); // Join all conditions with 'OR'

        // Append the combined conditions to the queryPart and close the parenthesis
        queryPart += conditions + ')';
      }

      if (excludeWords) {
        excludeWords.forEach((word) => {
          queryPart += ' AND title NOT LIKE ? AND content NOT LIKE ?';
          params.push(`%${word.trim()}%`, `%${word.trim()}%`);
        });
      }

      if (categories && categories.length > 0) {
        const categoryList = categories.map(() => '?').join(', ');
        queryPart += ` AND ${table}.category IN (${categoryList})`;
        countPart += ` AND ${table}.category IN (${categoryList})`;
        params.push(...categories);
      }

      if (externalSources) {
        console.log('Applying externalSource filter on table', table);
        queryPart += ` AND ${table}.externalSource IS NOT NULL AND ${table}.externalSource <> ""`;
      }
      // Date range filters
      if (createdStartDate) {
        queryPart += ` AND ${table}.created_at >= ?`; // Specify the table name explicitly
        params.push(createdStartDate);
      }

      if (createdEndDate) {
        queryPart += ` AND ${table}.created_at <= ?`; // Specify the table name explicitly
        params.push(createdEndDate);
      }

      if (publishStartDate) {
        // Ensure 'scheduledPublishTime' is a valid column in the respective tables
        if (table === 'works' || table === 'news') {
          queryPart += ` AND ${table}.scheduledPublishTime >= ?`; // Specify the table name explicitly
          params.push(publishStartDate);
        }
      }

      if (publishEndDate) {
        if (table === 'works' || table === 'news') {
          queryPart += ` AND ${table}.scheduledPublishTime <= ?`; // Specify the table name explicitly
          params.push(publishEndDate);
        }
      }

      queryPart += ` ${getOrderByClause(sort, table)}`;

      queryPart += ')'; // Closing the subquery

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

// Define a function to determine the ORDER BY clause

const getOrderByClause = (sort, table) => {
  console.log(`Sorting for table: ${table} with sort parameter: ${sort}`);

  const validSortColumns = {
    works: ['publishTime', 'created_at'],
    news: ['publishTime', 'created_at'],
    persons: ['created_at'],
    soon: ['created_at'],
  };

  const sortDirection = sort.endsWith('_desc') ? 'DESC' : 'ASC';
  const sortField = sort.replace(/_(asc|desc)$/, '');

  console.log(
    `Determined sort field: ${sortField} and direction: ${sortDirection}`
  );

  // Check if the table has the sort field
  if (validSortColumns[table] && validSortColumns[table].includes(sortField)) {
    const orderByClause = `ORDER BY ${table}.${sortField} ${sortDirection}`;
    console.log(`Generated ORDER BY clause: ${orderByClause}`);
    return orderByClause;
  }

  console.log(`No valid sort field found for ${table} with sort ${sort}`);
  return ''; // Default to no ORDER BY clause if not valid or not applicable
};
