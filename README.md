# node-red-contrib-ftp-server-ext
A Node-RED node that allows to run an embedded FTP server inside Node-RED.

I would like to thank the folks from QuorumDMS for their support for [ftp-srv](https://github.com/QuorumDMS/ftp-srv), and for kindly reviewing all my pull requests.

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-ftp-server-ext
```

## Support my Node-RED developments
Please buy my wife a coffee to keep her happy, while I am busy developing Node-RED stuff for you ...

<a href="https://www.buymeacoffee.com/bartbutenaers" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy my wife a coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

## Node usage
This node contains an FTP-server 100% written in Javascript, which means there need no third party tools to be installed separately.

### Starting and stopping the FTP server
The FTP can be started and stopped easily by injecting a message:

![start stop](https://user-images.githubusercontent.com/14224149/176360540-7a2f6759-faa3-408d-9cbe-5dd31db1e375.png)
```
[{"id":"3a840622d3277af6","type":"inject","z":"fbee74db83781e91","name":"","props":[{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"start","x":610,"y":780,"wires":[["59520b2ebbcd2d0b"]]},{"id":"bcc245f12d7ddfd0","type":"inject","z":"fbee74db83781e91","name":"","props":[{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"stop","x":610,"y":840,"wires":[["59520b2ebbcd2d0b"]]},{"id":"eedc5e48847e17bf","type":"debug","z":"fbee74db83781e91","name":"FTP events","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","statusVal":"","statusType":"auto","x":970,"y":780,"wires":[]},{"id":"59520b2ebbcd2d0b","type":"ftp-server-ext","z":"fbee74db83781e91","name":"","protocol":"ftp","hostname":"127.0.0.1","port":"7021","authentication":"basic","blacklist":"[\"MKD\"]","whitelist":"[]","autostart":"enable","allowPassive":"block","traceLog":"enable","privateKey":"/home/pi/.node-red\\privkey.pem","publicCertificate":"/home/pi/.node-red\\cert.pem","certificationAuthority":"","passiveAddressResolver":"fixed","passiveDataHostname":"homespy2.duckdns.org","passiveStartPort":1024,"passiveEndPort":65535,"x":780,"y":780,"wires":[["eedc5e48847e17bf"]]}]
```
Once the FTP server has been started, the ***number of connected FTP clients*** will be displayed inside the node status.

There are two ways to "auto start" this node, i.e. start the FTP server automatically when the flow is started or (re)deployed:
+ Adjust the settings of the first inject node, to inject the 'start' message automatically after the flow is started.
+ Enable the autostart setting in the first tabsheet of the node's config screen.

## Node properties

### General

#### Protocol:
Currently the following protocols are being supported by this node:
+ *FTP*: Plain unencrypted FTP.
+ *FTPS*: also known as FTP-SSL, is a more secure form of FTP (with security added to commands and data transfer).  When this option is selected, the TLS tabsheet will become active.

*SFTP* is not supported!  While FTPS adds a layer to the FTP protocol, SFTP is an entirely different protocol based on the network protocol SSH (Secure Shell).

#### Hostname:
The hostname (or IP address) to which the FTP server will listen, to accept incoming connections.

![hostnames](https://user-images.githubusercontent.com/14224149/177923493-dfd570bc-f195-436e-a37c-96390e49efbf.png)

1. ***127.0.0.1 (or localhost)***: this loopback is a fake network adapter that allows applications on the same host to communicate with each other without network hardware.  Which means the FTP server will only accept connections from FTP clients running on the same host.

2. ***0.0.0.0***: this special IPv4 address means that the FTP server will to all the network interfaces on this host.  Which means the FTP server will accept connections from all the IP addresses of this host (in this example 127.0.0.1 and 192.168.1.1 and 10.1.2.1).

3. ***IP address***: the FTP server will only listen to 1 specific network interface on this host.  In this example the FTP server will only accept connections that try to access IP address 192.168.1.1.

The hostname must be the external IP address to accept external connections. Hostname `0.0.0.0` will listen on any available hosts for server and passive connections.

#### Port:
The port on which the FTP server will listen for incoming connections.  When no port is specified, the default port number will be used (21 for FTP or 22 for FTPS).

#### Root:
The directory that will become the root directory for the users.
+ When no root directory is specified, then the entire filesystem will be accessible via FTP.
+ When a root folder is specified, then only that folder and its sub-folders will be accessible via FTP.

#### Authentication:
Specify which authentication mechanism needs to be used to login:
+ Basic authentication</b>: A username and password is required.
+ Anonymous allowed</b>: Allow clients to authenticate using the username 'anonymous' (without a password).

#### Username:
The name of the user required to logon.  This will only be used if basic authentication has been activated.

#### Password:
The password required to logon.  This will only be used if basic authentication has been activated.

#### Blacklist:
Array of FTP commands that are not allowed.  For example `['RMD', 'RNFR', 'RNTO']` will not allow users to delete directories or rename files.  When a client still wants to do it, a response code 502 is returned to that client.  See [here](https://en.wikipedia.org/wiki/List_of_FTP_commands) for a list of all available FTP commands, and [here](https://github.com/QuorumDMS/ftp-srv/tree/main/src/commands/registration) for an overview of which of those commands are supported by this node.

#### Whitelist:
Array of commands that are only allowed.  When a client wants to try another command, a response code 502 (= bad gateway error) is returned to that client.  See the previous 'Blacklist' property for an overview of the FTP commands.

#### Autostart:
This option can be used to start the FTP server automatically when the flow starts or after a redeploy, to avoid having to use an extra Inject node to accomplish this.

#### Passive:
FPT connections can be ***active*** or ***passive***.  There are lots of tutorials which explain the difference between both connection modes, for example [here](https://www.jscape.com/blog/active-v-s-passive-ftp-simplified).

Specify whether passive mode is allowed or not:
+ Allow: Passive connections are allowed (next to the active connections).  When this option is selected, the 'Passive' tabsheet will become active.
+ Block: Passive connections are not allowed (so only active connections are allowed).  When a client tries to connect in passive mode (via the PASV command), the FTP server switch automatically to active mode.

#### Trace log:
Specify whether trace logging is enabled or not.  When enabled, detailed information will be written to the server-side console log.

### TLS
These settings apply to the setup of secure TLS connections, i.e. to be able to offer FTPS.

#### Key file:
The path to the PEM file containing the private key file, used to decrypt the data arriving from the client over TLS.  This can be the path to the Node-RED private key file (e.g. `/home/pi/.node-red\privkey.pem`).

#### Certificate:
The path to the PEM file containing the public certificate (belonging to the previously specified private key), used by the client to encrypt the data to be send over TLS.   This can be the path to the Node-RED certificate file (e.g. `/home/pi/.node-red\cert.pem`).

#### CA:
The path to the PEM file containing the certificate(s) of your CA (= Certificate Authority like e.g. LetsEncrypt), which means the root and optionally intermediate certificates (belonging to the previously specified private key).  This can be the path to the Node-RED certificate file (e.g. `/home/pi/.node-red\fullchain.pem`).
    
### Passive
These settings apply to the setup of passive FTP connections.
    
#### Data address:
During the passive handshake connection (after a PASV command has been received), an IP address for the data will be returned to the client.  This can be one of two options:
+ *Fixed address*: A static (external WAN) IP address.  Connections from localhost will return 127.0.0.1 to the client.
+ *Client based*: Return a different IP address whether the client is connecting from the WAN or from the LAN.

#### Hostname:
The hostname that will be send to the client, so the client can connect to it for getting data.

#### Start port:
The starting port to accept passive connections.

#### End port:
The ending port to accept passive connections.
