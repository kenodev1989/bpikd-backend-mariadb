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
        // Ensure excludeWords is treated as an array, even if it's a single string
        const wordsArray = Array.isArray(excludeWords)
          ? excludeWords
          : excludeWords.split(',');

        wordsArray.forEach((word) => {
          word = word.trim();
          if (word) {
            // Check if the word is not empty after trimming
            if (table === 'persons') {
              // Using firstName and lastName for persons
              queryPart += ` AND firstName NOT LIKE ? AND lastName NOT LIKE ?`;
              params.push(`%${word}%`, `%${word}%`);
            } else {
              // Using title and content for other tables, specifying the table name to avoid ambiguity
              queryPart += ` AND ${table}.title NOT LIKE ? AND ${table}.content NOT LIKE ?`;
              params.push(`%${word}%`, `%${word}%`);
            }
          }
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

      // Append the dynamic ORDER BY clause
      const orderByClause = getOrderByClause(sort, table);
      if (orderByClause) {
        queryPart += ` ${orderByClause}`;
      }

      queryPart += ')'; // Closing the subquery
      sqlParts.push(queryPart);

      console.log(`Query for table ${table}:`, queryPart);
    });

    const fullSql = sqlParts.join(' UNION ALL ') + ' LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);

    console.log('Executing SQL:', fullSql, params);

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

  // Explicitly define how each sort option translates to SQL for each table
  const sortOptions = {
    release_desc: {
      news: 'scheduledPublishTime DESC',
      works: 'works.scheduledPublishTime DESC',
      soon: 'scheduledPublishTime DESC',
      // Assuming 'persons' does not use publishTime, no entry is needed
    },
    release_asc: {
      news: 'scheduledPublishTime ASC',
      works: 'works.publishTime ASC',
      soon: 'scheduledPublishTime ASC',
    },
    document_desc: {
      news: 'created_at DESC',
      works: 'works.created_at DESC',
      persons: 'created_at DESC',
      soon: 'created_at DESC',
    },
    document_asc: {
      news: 'created_at ASC',
      works: 'works.created_at ASC',
      persons: 'created_at ASC',
      soon: 'created_at ASC',
    },
  };

  // Determine the correct SQL fragment based on the table and sort parameter
  if (sortOptions[sort] && sortOptions[sort][table]) {
    const orderByClause = sortOptions[sort][table];
    console.log(`Generated ORDER BY clause: ${orderByClause}`);
    return `ORDER BY ${orderByClause}`;
  }

  console.log(`No valid sort field found for ${table} with sort ${sort}`);
  return ''; // Default to no specific ORDER BY clause if not valid or not applicable
};
