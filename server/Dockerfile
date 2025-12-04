# Use Node LTS
FROM node:20

# Set working directory
WORKDIR /app

# Copy only backend package.json
COPY server/package*.json ./

# Install backend dependencies
RUN npm install --production

# Copy backend source code
COPY server/. .

# Expose backend port
EXPOSE 5000

# Start backend server
CMD ["node", "server.js"]
