# Use Node LTS
FROM node:20

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy the rest of the backend source
COPY . .

# Expose the backend port
EXPOSE 5000

# Start the backend
CMD ["npm", "start"]
