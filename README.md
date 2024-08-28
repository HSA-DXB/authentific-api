# Loopback & MySQL via docker-compose.

## About

**Description**:

A Base docker project to get up and running with [Loopback](http://loopback.io) and [MySQL](https://www.mysql.com/). This project also includes boot scripts located in `server/boot` to automatically do database migration/update so that you can move a bit quicker with your schema, tables, and data structures. Apart from the migration scripts this project is a fresh sheet of ice, in that, there are no models, widgets, relations, or permissions set up.

**Tech Specifications**:

Node: `6.11.1` -> Latest LTS: Boron
StrongLoop: `3.x`
MySQL: `5.6` -> [Amazon Aurora DB](https://aws.amazon.com/rds/aurora/) drop-in at 1/10th of the cost!

## Install/Set Up

**Prerequisites**:

You need to have both [docker](https://docs.docker.com/engine/installation/) and [docker-compose](https://docs.docker.com/compose/install/) installed.

**Notes**:

Number one, I've created a make file to make life a bit easier. Number two, if you wish to do a complete fresh install, as in, remove all the current loopback scaffolding you can do so via:

```bash
   # deletes all loopback scaffolding
   make NUKE
   # loopback-cli scaffolding
   make setup-loopback
```

**1) Install Dependencies**:

First task of business is to install the npm dependencies:

```bash
   npm install
   # or use the make script
   make install-deps
```

**2) Start docker-compose**

Last task of business is to boot up the docker containers:

```bash
   make start # runs -> docker-compose up
```

**3) Open Browser**

To make sure everything worked according to plan open open [`localhost:3002`](http://localhost:3002/). It should display a simple JSON Object with a `"started"` and `"uptime"` property. To view the api cruz on over to [`localhost:3002/explorer/`](http://localhost:3002/explorer/).

## Create Model

To create a new loopback model:

```bash
   make model a=Widget
```

IMPORTANT: After you create a new model you will have to perform a db migration which you can read about bellow.

## Database Migration

For the most part db migration is automated through the boot scripts but you'll have to update the script accordingly. Let's say we create a new model, then we will have to edit the `/server/boot/migration.custom.js` file and add the new model to the `MODELS` Array in String format. However, if you add a alter/add the `properties` on a model the migration script will automaticaly sync up the new schema.

You can also do a db migration via `/__scripts__/migrate.js` and like the automated scripts you will have to add your custom models to the `MODELS` Array. You can then run this script via: `make migrate`.

## Loopback Make Commands

There are a few Makefile commands to make life a bit easier. Nothing magical just a wrapper around `docker-compose run api lb`. You must pass an argument to the `api` and `model` command.

**api**

```bash
   make api a=middleware
   make api a='Model Widget'
```

**model**

```bash
   make model a=Widget
```

**Relation -> (no arguments)**

```bash
   make relation
```

## Debug Node

To spawn a node inspect debugger within the container you must un-comment the debug port and debug command in the `docker-compose.yml` file like so:

```yaml
api:
  ports:
    - 3002:3000
    # Debug port
    - 9229:9229
  # command: nodemon . -> comment out default command
  command: nodemon -L --inspect .
```

## MySQL Environment

The MySQL docker image is setup via `environment` variables to set up the the db. These variables are set in the root `.env` file. Remember, these variables must correspond with `/server/datasources.json`.

# Deployment Guide for Authentific API

## Adding SSH Key

To securely access your DigitalOcean Droplet, you need to add your SSH key. Follow the instructions in the official DigitalOcean documentation: [How to Add SSH Keys](https://docs.digitalocean.com/products/droplets/how-to/add-ssh-keys/).

## Deployment Steps

1. **Log into DigitalOcean**

   - Go to your DigitalOcean account and navigate to the Droplet named `authentific-api-new`.

2. **SSH into the Server**

   - Click on the IPv4 address of your Droplet.
   - Open your terminal and connect to the server using:
     ```bash
     ssh root@<your_ipv4_address>
     ```

3. **Navigate to the Project Directory**

   - Once logged in, navigate to the project directory:
     ```bash
     cd /var/www/html/authentific-api-develop
     ```

4. **Pull the Latest Code**

   - Update your codebase by pulling the latest changes from your repository:
     ```bash
     git pull
     ```

5. **Check Node Version**

   - Before installing new modules, check the current Node.js version:
     ```bash
     node -v
     ```
   - If you encounter any issues related to the Node.js version, use NVM (Node Version Manager) to switch to the required version.

6. **Using NVM**

   - If NVM is not recognized, run the following command to load it:
     ```bash
     source ~/.bashrc
     ```

7. **Install Node Modules**

   - After ensuring the correct Node.js version, install the necessary modules:
     ```bash
     npm install
     ```

8. **Run the Application in the Background**

   - We use PM2 to manage the Node.js process in the background. The API runs on port 80.
   - Check the running processes with:
     ```bash
     pm2 list
     ```

9. **Restart the Process**
   - Identify the application name or ID (e.g., `server` or ID `11`) and restart the process:
     ```bash
     pm2 restart <app_name_or_id>
     ```

Now your Authentific API should be up and running on your DigitalOcean Droplet!
