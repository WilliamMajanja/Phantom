
# Use an official Node.js runtime as a parent image
# We use a Debian-based image to support the Python scripts and GPIO libraries
FROM node:20-bookworm

# Set the working directory
WORKDIR /app

# Install system dependencies for Raspberry Pi GPIO and Audio
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    libgpiod-dev \
    python3-gpiozero \
    pipewire \
    pipewire-audio-client-libraries \
    alsa-utils \
    curl \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the React application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Start the application using the orchestrator script
# We use a custom entrypoint to handle the background Python services
CMD ["npm", "run", "dev"]
