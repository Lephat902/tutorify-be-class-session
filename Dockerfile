ARG NODE_VERSION=18

FROM node:${NODE_VERSION}-alpine AS base

###################
# BUILD FOR LOCAL DEVELOPMENT
###################

FROM base AS development

WORKDIR /usr/src/app

RUN npm i -g @nestjs/cli

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure copying both package.json AND package-lock.json (when available).
# Copying this first prevents re-running npm install on every code change.
COPY --chown=node:node package*.json ./

# Install ALL app dependencies, including 'devDependencies'
RUN npm ci

# Bundle app source
COPY --chown=node:node . .

# Default cmd to run dev (can be overwritten by external cmd)
CMD [ "npm", "run", "start:dev" ]

###################
# BUILD FOR PRODUCTION
###################

FROM development AS build

# Set NODE_ENV environment variable
ENV NODE_ENV production

# Switch to shared dir
WORKDIR /usr/src/shared

# Copy temp 'shared' dir
COPY --chown=node:node ./shared .

# Install packages of shared dir for 'npm run build' below to succeed, those packages will not be included in built image
RUN npm ci --only=production

# Switch to app dir
WORKDIR /usr/src/app

# Run the build command which creates the production bundle
RUN npm run build

# Remove devDependencies packages
RUN npm prune --production

USER node

###################
# PRODUCTION
###################

FROM base AS production

# Copy the bundled code from the build stage to the production image
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist

# Switch to user node for security
USER node

# Start the server using the production build
CMD [ "node", "dist/app/src/main.js" ]