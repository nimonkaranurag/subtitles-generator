# Step 1: Use an official Node.js runtime as the base image
FROM node:14

# Step 2: Set the working directory inside the container
WORKDIR /app

# Step 3: Copy package.json and package-lock.json to install dependencies
COPY package*.json ./

# Step 4: Install dependencies
RUN npm install

# Step 5: Install FFmpeg (this is the new step)
RUN apt-get update && apt-get install -y ffmpeg

# Step 6: Copy the rest of the application files into the container
COPY . .

# Step 7: Expose the port that the application listens on
EXPOSE 8080

# Step 8: Set the environment variable for Google credentials
ENV GOOGLE_APPLICATION_CREDENTIALS="/app/subtitle-generator-439201-227fcad98028.json"

# Step 9: Start the Node.js application
CMD ["node", "index.js"]
