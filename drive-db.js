const { google } = require('googleapis');
const stream = require('stream');

const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '')
  .replace(/\\n/g, '\n')
  .replace(/^"|"$/g, '')
  .trim();

const clientEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '')
  .replace(/^"|"$/g, '')
  .trim();

const FOLDER_ID = (process.env.GOOGLE_DRIVE_FOLDER_ID || '')
  .replace(/^"|"$/g, '')
  .trim();

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: clientEmail,
    private_key: privateKey,
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

async function getFileId(filename) {
  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and name = '${filename}.json' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files && res.data.files.length > 0 ? res.data.files[0].id : null;
}

async function readFromDrive(filename) {
  try {
    const fileId = await getFileId(filename);
    if (!fileId) return [];

    const res = await drive.files.get(
      { fileId: fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'json' }
    );
    return res.data;
  } catch (err) {
    console.error(`Error reading ${filename} from Drive:`, err.message);
    return [];
  }
}

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
      await drive.files.update({
        fileId: fileId,
        media: media,
        supportsAllDrives: true,
      });
    } else {
      await drive.files.create({
        requestBody: {
          name: `${filename}.json`,
          parents: [FOLDER_ID],
        },
        media: media,
        supportsAllDrives: true,
      });
    }
    console.log(`Successfully synced ${filename} to Drive!`);
  } catch (err) {
    console.error(`Error writing ${filename} to Drive:`, err.message);
    throw err;
  }
}

// Strict read: returns null if the file does not exist, THROWS on any error (so we never mistake an error for "empty")
async function readFromDriveStrict(filename) {
  const fileId = await getFileId(filename);
  if (!fileId) return null;
  const res = await drive.files.get(
    { fileId: fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'json' }
  );
  return res.data;
}

// Update an EXISTING file only. Service accounts have no storage quota, so they cannot create files.
async function updateDriveFile(filename, data) {
  const fileId = await getFileId(filename);
  if (!fileId) {
    throw new Error(`${filename}.json is not in the Drive folder. Create it once manually (content: {}) - service accounts cannot create files.`);
  }
  const bufferStream = new stream.PassThrough();
  bufferStream.end(JSON.stringify(data));
  await drive.files.update({
    fileId: fileId,
    media: { mimeType: 'application/json', body: bufferStream },
    supportsAllDrives: true,
  });
}

module.exports = { readFromDrive, writeToDrive, readFromDriveStrict, updateDriveFile };