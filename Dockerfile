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

# Use the node user from the image (instead of the root user)
# USER node

# Default cmd to run dev (can be overwritten by external cmd)
CMD [ "npm", "run", "start:dev" ]

###################
# BUILD FOR PRODUCTION
###################

FROM development AS build

WORKDIR /usr/src/app

COPY --chown=node:node package*.json ./

# In order to run `npm run build` we need access to the Nest CLI which is a dev dependency. In the previous development stage we ran `npm ci` which installed all dependencies, so we can copy over the node_modules directory from the development image
COPY --chown=node:node --from=development /usr/src/app/node_modules ./node_modules

# Copy temp 'shared' dir
COPY --chown=node:node ./shared /usr/src/shared

COPY --chown=node:node . .

# the 'npm ci' cmd requires root access
USER root

# Switch to shared dir
WORKDIR /usr/src/shared

# Install packages
RUN npm ci --only=production && npm cache clean --force

# Switch back to app dir
WORKDIR /usr/src/app

# Run the build command which creates the production bundle
RUN npm run build

# Set NODE_ENV environment variable
ENV NODE_ENV production

# Running `npm ci` removes the existing node_modules directory and passing in --only=production ensures that only the production dependencies are installed. This ensures that the node_modules directory is AS optimized AS possible
RUN npm ci --only=production && npm cache clean --force

USER node

###################
# PRODUCTION
###################

FROM base AS production

# Copy the bundled code from the build stage to the production image
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist

# Start the server using the production build
CMD [ "node", "dist/app/src/main.js" ]
