const express = require('express');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const { SpeechClient } = require('@google-cloud/speech');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');  // Import fs for file handling

// Initialize the Express app
const app = express();
const port = process.env.PORT || 8080;

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Google Cloud Storage setup
const storage = new Storage();
const bucketName = 'vid-dump';  // Make sure this matches your bucket name

// Google Cloud Speech-to-Text setup
const speechClient = new SpeechClient();

// Health check route
app.get('/', (req, res) => {
    res.send('Subtitle Generator Backend is running');
});

// Function to generate SRT subtitles from transcription
function generateSRT(transcription, duration) {
    if (!transcription) {
        return ''; // Return empty string if transcription is empty
    }

    const lines = transcription.split('\n');
    let srtContent = '';
    let startTime = 0;
    const lineDuration = duration / lines.length; // Approximate duration for each line

    lines.forEach((line, index) => {
        const endTime = startTime + lineDuration;

        // Format time as HH:MM:SS,MMM (SRT format requires milliseconds)
        const formatTime = (timeInSeconds) => {
            const date = new Date(null);
            date.setSeconds(timeInSeconds);
            return date.toISOString().substr(11, 12).replace('.', ',');
        };

        srtContent += `${index + 1}\n`;
        srtContent += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
        srtContent += `${line}\n\n`;

        startTime = endTime;
    });

    return srtContent;
}


// Endpoint to upload video, extract audio, transcribe audio, and generate SRT
app.post('/upload', upload.single('video'), async (req, res) => {
    const { file } = req;

    if (!file) {
        return res.status(400).send('No file uploaded');
    }

    console.log('File uploaded successfully to the server.');

    const outputAudioPath = path.join('uploads', `${file.originalname}.wav`);
    const outputSRTPath = path.join('subtitles', `${file.originalname}.srt`); // SRT file path

    try {
        console.log('Starting FFmpeg audio extraction...');

        const ffmpeg = spawn('ffmpeg', ['-y', '-i', file.path, '-ac', '1', '-q:a', '0', '-map', 'a', outputAudioPath]);

        ffmpeg.stdout.on('data', (data) => {
            console.log(`FFmpeg stdout: ${data}`);
        });

        ffmpeg.stderr.on('data', (data) => {
            console.error(`FFmpeg stderr: ${data}`);
        });

        ffmpeg.on('close', async (code) => {
            if (code !== 0) {
                console.error(`FFmpeg process exited with code ${code}`);
                return res.status(500).send(`FFmpeg process failed with code ${code}`);
            }

            console.log('FFmpeg command completed successfully.');

            // Upload the audio file to Google Cloud Storage
            try {
                console.log('Uploading audio file to Google Cloud Storage...');
                await storage.bucket(bucketName).upload(outputAudioPath, {
                    destination: `${file.originalname}.wav`,
                });
                console.log('File uploaded to Google Cloud Storage successfully.');

                const gcsUri = `gs://${bucketName}/${file.originalname}.wav`;

                // Transcribe the audio using Google Speech-to-Text
                console.log('Starting transcription using Google Cloud Speech-to-Text...');
                const transcription = await transcribeAudio(gcsUri);
                console.log('Transcription completed:', transcription);

                // Generate the SRT file
                const audioDuration = 486; // This should be replaced with the actual audio duration in seconds
                const srtContent = generateSRT(transcription, audioDuration);

                // Check if 'subtitles' directory exists, if not, create it
                if (!fs.existsSync('subtitles')) {
                    fs.mkdirSync('subtitles');
                }

                // Write the SRT file to the filesystem
                fs.writeFileSync(outputSRTPath, srtContent);
                console.log('SRT file generated successfully.');

                res.status(200).send({
                    message: `File ${file.originalname} uploaded, transcribed, and SRT file generated.`,
                    downloadLink: `http://localhost:8080/download-srt/${file.originalname}`,
                });

            } catch (storageError) {
                console.error('Error uploading file to Google Cloud Storage:', storageError);
                return res.status(500).send(`Failed to upload file: ${storageError.message}`);
            }
        });

    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).send(`Failed to process file: ${error.message}`);
    }
});


// Function to transcribe audio using Google Cloud Speech-to-Text API (for longer audio files)
async function transcribeAudio(gcsUri) {
    const audio = {
        uri: gcsUri,
    };
    const config = {
        encoding: 'LINEAR16',
        sampleRateHertz: 44100,
        languageCode: 'en-US',
    };
    const request = {
        audio: audio,
        config: config,
    };

    // Use LongRunningRecognize for longer files
    const [operation] = await speechClient.longRunningRecognize(request);
    console.log('Waiting for operation to complete...');
    const [response] = await operation.promise();
    
    const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
    
    return transcription;
}

// Route to download the generated SRT file
app.get('/download-srt/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, 'subtitles', `${fileName}.srt`);

    res.download(filePath, (err) => {
        if (err) {
            console.error('Error downloading SRT file:', err);
            res.status(500).send('Error downloading file.');
        }
    });
});

// Export the app and the generateSRT function for testing
module.exports = { app, generateSRT };


// Start the server only if this is not in a test environment
if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}
