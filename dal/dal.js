// DAL Functions in ES6 Module Syntax

export async function create(model, body) {
  return await model.create(body);
}

export async function createMany(model, body) {
  return await model.insertMany(body);
}

export async function find(
  model,
  filter = {},
  pagination = {},
  sort = {},
  projection = {}
) {
  return await model
    .find(filter, projection)
    .sort(sort)
    .skip(pagination.skip)
    .limit(pagination.limit);
}

export async function findOne(model, filter, projection = {}) {
  return await model.findOne(filter, projection);
}

export async function findByID(model, id) {
  return await model.findById(id);
}

export async function countDocuments(model, filter) {
  return await model.countDocuments(filter);
}

export async function findOneAndUpdate(model, filter, body) {
  return await model.findOneAndUpdate(filter, body, { new: true });
}

export async function findOneAndUpsert(model, filter, body) {
  return await model.findOneAndUpdate(filter, body, {
    new: true,
    upsert: true,
    runValidators: true,
    context: "query",
    setDefaultsOnInsert: true,
  });
}

export async function updateMany(model, filter, body) {
  return await model.updateMany(filter, body, { new: true });
}

export async function findOneAndDelete(model, filter) {
  return await model.findOneAndDelete(filter);
}

export async function deleteMany(model, filter) {
  return await model.deleteMany(filter);
}

export async function aggregates(model, query) {
  return await model.aggregate(query).collation({ locale: "de", strength: 1 });
}
