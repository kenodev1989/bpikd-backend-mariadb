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
    page,
    limit = 4,
  } = req.body.query;

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
        queryPart = `(SELECT 'persons' AS source_table, id, CONCAT(firstName, ' ', lastName) AS title, aboutPerson AS content, createdBy, created_at, externalSource, category, scheduledPublishTime FROM persons WHERE 1=1`;
      } else if (table === 'works') {
        // Join the persons table to get firstName and lastName for each work
        queryPart = `(SELECT 'works' AS source_table, CONCAT(persons.firstName, ' ', persons.lastName) AS person_id, works.title, works.content, works.createdBy, works.created_at, works.externalSource, works.category, works.scheduledPublishTime
                FROM works 
                JOIN persons ON works.person_id = persons.id WHERE 1=1`;
      } else {
        queryPart = `(SELECT '${table}' AS source_table, id, title, content, createdBy, created_at, externalSource, category, scheduledPublishTime FROM ${table} WHERE 1=1`;
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

      if (searchTerm || searchTerm !== '') {
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
        countPart += ' AND (';

        // Map over each word to create an SQL condition for it
        const conditions = anyWords
          .map((word) => {
            // Ensure word is trimmed and non-empty
            word = word.trim();
            if (word) {
              // Push the parameters for each condition into the params array twice, once for title and once for content
              params.push(`%${word}%`, `%${word}%`);
              countParams.push(`%${word}%`, `%${word}%`);
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
        countPart += conditions + ')';
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
              countPart += ` AND firstName NOT LIKE ? AND lastName NOT LIKE ?`;
              params.push(`%${word}%`, `%${word}%`);
              countParams.push(`%${word}%`, `%${word}%`);
            } else {
              // Using title and content for other tables, specifying the table name to avoid ambiguity
              queryPart += ` AND ${table}.title NOT LIKE ? AND ${table}.content NOT LIKE ?`;
              countPart += ` AND ${table}.title NOT LIKE ? AND ${table}.content NOT LIKE ?`;
              params.push(`%${word}%`, `%${word}%`);
              countParams.push(`%${word}%`, `%${word}%`);
            }
          }
        });
      }

      if (categories && categories.length > 0) {
        const categoryList = categories.map(() => '?').join(', ');
        queryPart += ` AND ${table}.category IN (${categoryList})`;
        countPart += ` AND ${table}.category IN (${categoryList})`;
        params.push(...categories);
        countParams.push(...categories);
      }

      if (externalSources) {
        queryPart += ` AND ${table}.externalSource IS NOT NULL AND ${table}.externalSource <> ""`;
        countPart += ` AND ${table}.externalSource IS NOT NULL AND ${table}.externalSource <> ""`;
        /*   params.push(externalSources);
        countParams.push(externalSources); */
      }
      // Date range filters
      if (createdStartDate) {
        queryPart += ` AND ${table}.created_at >= ?`; // Specify the table name explicitly
        countPart += ` AND ${table}.created_at >= ?`; // Specify the table name explicitly
        params.push(createdStartDate);
        countParams.push(createdStartDate);
      }

      if (createdEndDate) {
        queryPart += ` AND ${table}.created_at <= ?`; // Specify the table name explicitly
        countPart += ` AND ${table}.created_at <= ?`; // Specify the table name explicitly
        params.push(createdEndDate);
        countParams.push(createdEndDate);
      }

      if (publishStartDate) {
        // Ensure 'scheduledPublishTime' is a valid column in the respective tables
        if (table === 'works' || table === 'news') {
          queryPart += ` AND ${table}.scheduledPublishTime >= ?`; // Specify the table name
          countPart += ` AND ${table}.scheduledPublishTime >= ?`; // Specify the table name explicitly
          params.push(publishStartDate);
          countParams.push(publishStartDate);
        }
      }

      if (publishEndDate) {
        if (table === 'works' || table === 'news') {
          queryPart += ` AND ${table}.scheduledPublishTime <= ?`; // Specify the table name
          countPart += ` AND ${table}.scheduledPublishTime <= ?`; // Specify the table name explicitly
          params.push(publishEndDate);
          countParams.push(publishEndDate);
        }
      }

      // Append the dynamic ORDER BY clause

      queryPart += ')'; // Closing the subquery
      countPart += ')'; // Closing the subquery
      sqlParts.push(queryPart);
      countParts.push(countPart);
    });

    // Execute the count queries to determine the total number of results

    const totalCountQueries = countParts.join(' UNION ALL ');
    const countResults = await pool.query(totalCountQueries, countParams);

    // Sum up all counts returned by the UNION ALL query
    const totalResults = countResults.reduce(
      (acc, curr) => acc + Number(curr['COUNT(*)']),
      0
    );

    const parsPage = parseInt(page);
    const parsLimit = parseInt(limit);

    // Calculate total pages
    const pages = Math.ceil(totalResults / parsLimit);

    // Adjust page number if out of bounds
    const currentPage = Math.min(parsPage, pages) || 1;
    const offset = (currentPage - 1) * parsLimit;

    // Construct final SQL query for fetching data
    const fullSql = `${sqlParts.join(
      ' UNION ALL '
    )} ORDER BY ${determineGlobalOrderBy(sort)} LIMIT ? OFFSET ?`;
    const queryResults = await pool.query(fullSql, [
      ...params,
      parsLimit,
      offset,
    ]);

    // Send response with data and pagination info
    res.json({ data: queryResults, totalResults, pages });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).send('Error during search');
  }
};

const determineGlobalOrderBy = (sort) => {
  switch (sort) {
    case 'document_desc':
      return 'created_at DESC';
    case 'document_asc':
      return 'created_at ASC';
    case 'release_desc':
      return 'scheduledPublishTime DESC';
    case 'release_asc':
      return 'scheduledPublishTime ASC';
    default:
      return 'created_at DESC'; // Default fallback when no specific sort is provided
  }
};

// Define a function to determine the ORDER BY clause
/* const determineGlobalOrderBy = (sort, table) => {
  console.log(`Sorting for table: ${table} with sort parameter: ${sort}`);

  // Define how each sort option translates to SQL for each table
  let orderByClause = '';
  switch (sort) {
    case 'document_desc':
      if (table === 'works') {
        orderByClause = 'works.created_at DESC'; // Specific to 'works'
      } else {
        orderByClause = 'created_at DESC'; // General case for other tables
      }
      break;
    case 'document_asc':
      if (table === 'works') {
        orderByClause = 'works.created_at ASC'; // Specific to 'works'
      } else {
        orderByClause = 'created_at ASC'; // General case for other tables
      }
      break;
    case 'release_desc':
      // Apply only if the table has a 'scheduledPublishTime'
      if (['news', 'soon'].includes(table)) {
        orderByClause = `${table}.scheduledPublishTime DESC`;
      }
      break;
    case 'release_asc':
      if (['news', 'soon'].includes(table)) {
        orderByClause = `${table}.scheduledPublishTime ASC`;
      }
      break;
  }

  return orderByClause ? `ORDER BY ${orderByClause}` : ''; // Only return a clause if one is set
}; */
