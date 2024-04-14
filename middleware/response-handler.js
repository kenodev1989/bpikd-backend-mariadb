// Utility to recursively convert all BigInt values in an object to strings
function bigIntToString(obj) {
  for (let key in obj) {
    if (typeof obj[key] === "bigint") {
      // Convert BigInt to string
      obj[key] = obj[key].toString();
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      bigIntToString(obj[key]); // Recursively update nested objects
    }
  }
}

export const responseHandler = (
  res,
  data,
  message = "Success",
  status = 200
) => {
  bigIntToString(data); // Convert all BigInts to strings in the data object
  res.status(status).json({
    status: status,
    message: message,
    data: data,
  });
};

// Define errorHandler
export const errorHandler = (res, status, message) => {
  if (typeof status !== "number") {
    console.error("Invalid status code", status); // Log for debugging
    status = 500; // Set a default status code if invalid
  }
  res.status(status).json({
    success: false,
    error: message,
  });
};

// Middleware to authorize Admin
export const authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    errorHandler(res, 403, "Access denied. Admins only.");
  }
};

// Middleware to authorize Owner
export const authorizeOwner = (req, res, next) => {
  if (req.user && req.user.role === "owner") {
    next();
  } else {
    errorHandler(res, 403, "Access denied. Owners only.");
  }
};

// Middleware to authorize Editor
export const authorizeEditor = (req, res, next) => {
  if (req.user && req.user.role === "editor") {
    next();
  } else {
    errorHandler(res, 403, "Access denied. Editors only.");
  }
};

export const canCreateUser = (req, res, next) => {
  const userRole = req.user.role;
  const newUserRole = req.body.role;

  // Editors cannot create any user
  if (userRole === "editor") {
    return errorHandler(
      res,
      403,
      "Access Denied: Editors cannot create users."
    );
  }

  // Admins cannot create Owners
  if (userRole === "admin" && newUserRole === "owner") {
    return errorHandler(
      res,
      403,
      "Access Denied: Admins cannot create Owners."
    );
  }

  // If no rules are violated, proceed to the next middleware or controller
  next();
};
