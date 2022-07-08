/**
 * Copyright 2022 Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
 module.exports = function (RED) {
    const FtpServer = require('ftp-srv');
    const buyan = require('bunyan');
    const fs = require('fs');
    const os = require('os');
    const Netmask = require('netmask').Netmask;

    function ExtendedFtpServerNode(config) {
        RED.nodes.createNode(this, config);
        this.protocol = config.protocol;
        this.hostname = config.hostname;
        this.port = config.port || 7021;
        this.rootDirectory = config.rootDirectory;
        this.authentication = config.authentication;
        this.blacklist = config.blacklist;
        this.whitelist = config.whitelist;
        this.traceLog = config.traceLog;
        this.autostart = config.autostart;
        this.allowPassive = config.allowPassive;
        this.privateKey = config.privateKey;
        this.publicCertificate = config.publicCertificate;
        this.certificationAuthority = config.certificationAuthority;
        this.passiveAddressResolver = config.passiveAddressResolver;
        this.passiveDataHostname = config.passiveDataHostname;
        this.passiveStartPort = config.passiveStartPort;
        this.passiveEndPort = config.passiveEndPort;
        this.ftpServer = null;
        this.serverStatus = null;
        this.connectionCount = 0;

        const node = this;

        // When no port has been specified, then use the default ftp(s) ports
        if(!node.port) {
            if(node.protocol === "ftp") {
                node.port = 21;
            }
            else { // FTPS
                node.port = 22;
            }
        }

        setStatus("STOPPED");

        if(node.autostart === "enable") {
            startFtpServer()
        }

        function setStatus(newStatus, clientCount) {
            node.serverStatus = newStatus;
            
            let color = "blue";
            if(newStatus === "ERROR") {
                color = "red";
            }
            
            let statusText = newStatus.toLowerCase() + " (" + node.connectionCount + ")";
            
            node.status({ fill: color, shape: 'ring', text: statusText});
        }
        
        function validateFtpCommands(cmdArray) {
            if(!cmdArray) {
                return null;
            }
            
            if(typeof cmdArray === "string") {
                if(cmdArray.trim() == "") {
                    return null;
                }
            
                try {
                    cmdArray = JSON.parse(cmdArray);
                }
                catch(err) {
                    throw("Invalid json");
                }
            }
                
            if(!Array.isArray(cmdArray)) {
                 throw("No array");
            }
            
            if(cmdArray.length === 0) {
                return null;
            }
            
            // TODO check whether all the commands in the array are supported (see https://github.com/QuorumDMS/ftp-srv/discussions/330)
            
            return cmdArray;
        }
        
        // The code for this function is copied from https://github.com/QuorumDMS/ftp-srv#pasv_url
        // TODO can those networks be fetched once and then cached??
        function getNetworks() {
            if(!node.networkInterfaces) {        
                // Get the list of network interfaces of the device where this Node-RED instance is hosted.
                // Those network interfaces can be physical network interface cards (NIC) or a software based network interface.
                // Each network interface can be connected to a private LAN or a public WAN.
                node.networkInterfaces = os.networkInterfaces();
            }

            let networks = {};
            
            // Search through all the network interfaces of this device
            for (const networkInterfaceName of Object.keys(node.networkInterfaces)) {
                // Each network interface can have multiple network addresses (IPv4, IPv6, ...)
                for (const networkAddress of node.networkInterfaces[networkInterfaceName]) {
                    if (networkAddress.family === 'IPv4' && !networkAddress.internal) {
                        networks[networkAddress.address + "/24"] = networkAddress.address
                    }
                }
            }

            return networks;
        }

        function getNetworkOfClient(clientAddress) {
            const networks = getNetworks();

            for (const network in networks) {
                if (new Netmask(network).contains(clientAddress)) {
                    return networks[network];
                }
            }

            return "127.0.0.1";
        }

        function startFtpServer() {
            let options = {};
            let blacklist, whitelist;
            
            try {
                blacklist = validateFtpCommands(node.blacklist);
            }
            catch(err) {
                node.error("Error in blacklist: " + err);
                setStatus("ERROR");
                return;
            }
            
            try {
                whitelist = validateFtpCommands(node.whitelist);
            }
            catch(err) {
                node.error("Error in whitelist: " + err);
                setStatus("ERROR");
                return;
            }
                        
            if(node.traceLog === "disable") {
                // The ftp-srv library creates a byan logger that logs too much, therefore we will adjust the loglevel to only log warnings and errors
                options.log = buyan.createLogger({
                    name: 'ftp-srv',
                    level: 'warn'
                });
            }

            options.url = node.protocol + '://' + node.hostname + ':' + node.port;

            if(node.authentication === "anonymous") {
                options.anonymous = true;
            }
            else {
                options.anonymous = false;
            }

            if(blacklist) {
                options.blacklist = blacklist;
            }
            
            if(whitelist) {
                options.whitelist = whitelist;
            }
            
            // In case of ftps, specify at least a key pair
            if(node.protocol === "ftps") {
                try {
                    // Based on the code of a unit test (https://github.com/QuorumDMS/ftp-srv/blob/main/test/start.js)
                    options.tls = {
                        key: fs.readFileSync(node.privateKey),
                        cert: fs.readFileSync(node.publicCertificate)
                    }
                    
                    // Optional certification authority
                    if(node.certificationAuthority) {
                        options.tls.ca = fs.readFileSync(node.certificationAuthority);
                    }
                }
                catch(err) {
                    node.error("Cannot read PEM file " + err);
                    return;
                }
            }
 
            if(node.allowPassive === "allow") {
                switch(node.passiveAddressResolver) {
                    case "fixed":
                        // TODO test whether node.passiveDataHostname is valid
                        options.pasv_url = node.passiveDataHostname;
                        break;
                    case "client":
                        // Pass the getNetworkOfClient function to the ftp-srv library as a callback function.
                        options.pasv_url = getNetworkOfClient;
                        break;
                }

                if(node.passiveStartPort) {
                    options.pasv_min = node.passiveStartPort;
                }
                
                if(node.passiveEndPort) {
                    options.pasv_max = node.passiveEndPort;
                }
            }
            
            setStatus("STARTING");

            node.ftpServer = new FtpServer(options);

            node.ftpServer.listen().then(() => { 
                setStatus("STARTED");
            });

            node.ftpServer.on('login', function(data, resolve, reject) { 
                if(data.username === node.credentials.username && data.password === node.credentials.password){
                    data.connection.on('RETR', function(error, filePath) {
                        // Occurs when a file is downloaded
                        node.send({
                            topic: "file_downloaded",
                            payload: {
                                error: error,
                                filePath: filePath
                            }
                        });
                    });

                    data.connection.on('STOR', function(error, fileName) {
                        // Occurs when a file is uploaded
                        node.send({
                            topic: "file_uploaded",
                            payload: {
                                error: error,
                                fileName: fileName
                            }
                        });
                    });

                    data.connection.on('RNTO', function(error, fileName) {
                        // Occurs when a file is renamed
                        node.send({
                            topic: "file_renamed",
                            payload: {
                                error: error,
                                fileName: fileName
                            }
                        });
                    });
                    // RMD FTP command
//This command causes the directory specified in the path name to be removed. If a relative path is provided, the server assumes the specified directory to be a subdirectory of the client's current working directory. To delete a file, the DELE command is used.

                    return resolve({ root: node.rootDirectory });    
                }

                return reject(new FtpServer.ftpErrors.GeneralError('Invalid username or password', 401));
            });

            node.ftpServer.on('client-error', function({connection, context, error}) {
                node.error("FTP client error: " + error);
                // Don't call setStatus here, because if we change the status to error and that client disconnects then the status will keep being error here...
            });

            node.ftpServer.on('server-error', function({error}) {
                node.error("FTP server error: " + error);
                setStatus("ERROR");
            });
            
            node.ftpServer.on('connect', function({connection, id, newConnectionCount}) {
                node.connectionCount = newConnectionCount;

                // Only change the connection count in the node status, but keep the status text (which should be 'STARTED' if the client count changes...)
                setStatus(node.serverStatus);
            });
            
            node.ftpServer.on('disconnect', function({connection, id, newConnectionCount}) {
                node.connectionCount = newConnectionCount;

                // Only change the connection count in the node status, but keep the status text (which should be 'STARTED' if the client count changes...)
                setStatus(node.serverStatus);
            });
            
            node.ftpServer.on('closing', function() {
                node.warn("FTP server closing");

                setStatus("STOPPING");
            });
            
            node.ftpServer.on('closed', function() {
                node.warn("FTP server closed");
                setStatus("STOPPED");
            });
        }
        
        function stopFtpServer() {
            if(node.ftpServer) {
                node.ftpServer.close();
                node.ftpServer = null;
                setStatus("STOPPED");
            }
        }
        
        node.on('input', function(msg) {
            switch(msg.topic) {
                case "start":
                    if(node.ftpServer) {
                        node.warn("The FTP server is already started");
                        return;
                    }
                    startFtpServer();
                    break;
                case "stop":
                    if(!node.ftpServer) {
                        node.warn("The FTP server is already stopped");
                        return;
                    }
                    stopFtpServer();
                    break;
                case "cert_reload":
                    let tlsOptions = {
                        key: fs.readFileSync("C:\\temp\\new_pems\\privkey.pem"),
                        cert: fs.readFileSync("C:\\temp\\new_pems\\cert.pem")
                        //ca: ...
                    }
                    // This will not work until pull-request (https://github.com/QuorumDMS/ftp-srv/pull/331) is implemented
                    node.ftpServer.renewTlsOptions(tlsOptions);
                    break;
                case "get_commands":
                    // I still need to create a pull-request to implement this:
                    //     getRegisteredCommands() {
                    //       let clonedRegistry = _.cloneDeep(registry);
                    //       Object.values(clonedRegistry).forEach((cmd) => {
                    //         delete cmd.handler;
                    //       });
                    //       return clonedRegistry;
                    //     }
                    msg.payload = node.ftpServer.getRegisteredCommands();
                    node.send(msg);
                    break;
                default:
                    node.warn("unsupported command '" + msg.topic + "' in msg.topic'");
            }
        });

        node.on('close', function() {
            stopFtpServer();
        });
    }
        
    RED.nodes.registerType('ftp-server-ext', ExtendedFtpServerNode, {
        credentials: {
            username: {
                type: 'text',
            },
            password: {
                type: 'password',
            }
        }
    })
}
