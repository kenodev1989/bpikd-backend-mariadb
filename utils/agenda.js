import Agenda from 'agenda';
import Person from '../models/personPost.js';
import dotenv from 'dotenv';
dotenv.config();

export const agenda = new Agenda({
  db: {
    address: process.env.MONGO_URI, // Corrected environment variable access
    collection: 'scheduledJobs',
  },
});

agenda.define('publish work', async (job) => {
  const { workId } = job.attrs.data;

  const personWithWork = await Person.findOne({ 'works._id': workId });
  if (personWithWork) {
    const work = personWithWork.works.id(workId);

    if (work) {
      work.isPublished = true;
      work.publishTime = 'Now';

      await personWithWork.save();
      console.log(`Work ${workId} published.`);
    }
  }
});

(async function () {
  // IIFE to give access to async/await
  await agenda.start();
  console.log('Agenda started.');
  // Define other job processing rules here
})();
