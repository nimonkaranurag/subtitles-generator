const { generateSRT } = require('./index');

describe('generateSRT', () => {
    test('should generate a correctly formatted SRT file', () => {
        const transcription = 'Hello world\nThis is a test';
        const duration = 10; // 10 seconds total duration

        const expectedSRT = `1
00:00:00,000 --> 00:00:05,000
Hello world

2
00:00:05,000 --> 00:00:10,000
This is a test

`;

        const result = generateSRT(transcription, duration);

        expect(result).toBe(expectedSRT);
    });

    test('should handle empty transcription gracefully', () => {
        const transcription = '';
        const duration = 10;

        const result = generateSRT(transcription, duration);

        expect(result).toBe(''); // Expect empty string when transcription is empty
    });

    test('should format time correctly for longer durations', () => {
        const transcription = 'Single line test';
        const duration = 3600; // 1 hour

        const expectedSRT = `1
00:00:00,000 --> 01:00:00,000
Single line test

`;

        const result = generateSRT(transcription, duration);

        expect(result).toBe(expectedSRT);
    });
});
