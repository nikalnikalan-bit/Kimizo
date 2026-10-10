const { google } = require('googleapis');
const stream = require('stream');

const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/drive']
);

const drive = google.drive({ version: 'v3', auth });
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Folder-ல் உள்ள குறிப்பிட்ட ஃபைலின் ID-ஐக் கண்டறியும் helper
async function getFileId(filename) {
  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and name = '${filename}.json' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  return res.data.files.length > 0 ? res.data.files[0].id : null;
}

// Drive-ல் இருந்து JSON data-ஐப் பெறுதல்
async function readFromDrive(filename) {
  try {
    const fileId = await getFileId(filename);
    if (!fileId) return [];

    const res = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'json' }
    );
    return res.data;
  } catch (err) {
    console.error(`Error reading ${filename} from Drive:`, err.message);
    return [];
  }
}

// Drive-க்கு JSON data-ஐச் சேமித்தல்
async function writeToDrive(filename, data) {
  try {
    const fileId = await getFileId(filename);
    const bufferStream = new stream.PassThrough();
    bufferStream.end(JSON.stringify(data, null, 2));

    const media = {
      mimeType: 'application/json',
      body: bufferStream,
    };

    if (fileId) {
      // ஏற்கெனவே ஃபைல் இருந்தால் update செய்தல்
      await drive.files.update({
        fileId: fileId,
        media: media,
      });
    } else {
      // ஃபைல் இல்லையெனில் புதிதாக உருவாக்குதல்
      await drive.files.create({
        requestBody: {
          name: `${filename}.json`,
          parents: [FOLDER_ID],
        },
        media: media,
      });
    }
  } catch (err) {
    console.error(`Error writing ${filename} to Drive:`, err.message);
  }
}

module.exports = { readFromDrive, writeToDrive };