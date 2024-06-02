function generateThumbnail(videoPath, outputPath, time) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(err);
      })
      .screenshots({
        timestamps: [time],
        filename: 'thumbnail-at-%s-seconds.png',
        folder: outputPath,
      });
  });
}
