#You'll need to download forge_server_setup.tar.bz2 from troveup-backups/forge on the Production Google Cloud Storage network
#and have it in the same directory as this script
#Install Node
sudo curl --silent --location https://deb.nodesource.com/setup_4.x | sudo bash -
sudo apt-get install --yes nodejs

#Install node's monitoring software
sudo npm install forever -g

#Install bzip2, necessary for tar later
sudo apt-get install --yes bzip2

#Install build tools for building node modules
sudo apt-get install --yes make
sudo apt-get install --yes g++

#Unzip the workspace directory
tar -xvjf ./forge_server_setup.tar.bz2

#Blender needs this to run
sudo apt-get install --yes libsdl-image1.2

#Rebuild the node modules
cd ./workspace/FORGE/forge/test-server
rm -rf ./node_modules
sudo npm install

#Move the working directory over to where the startup script expects
cd ../../../..
sudo cp -r ./workspace/ /usr/local/

#Link the Blender executable so FORGE can see it
sudo ln -s /usr/local/workspace/blender/blender-2.69-linux-glibc211-x86_64/blender /usr/bin/blender

#Check to make sure the libGL libraries are installed on this distro, sometimes they aren't
if [ ! -f /usr/lib/x86_64-linux-gnu/libGL.so.1 ]; then
	sudo ln -s /usr/local/workspace/blender/blender-2.69-linux-glibc211-x86_64/lib/libGL.so.1.5.08005 /usr/lib/x86_64-linux-gnu/libGL.so.1
fi

if [ ! -f /usr/lib/x86_64-linux-gnu/libGLU.so.1 ]; then
	sudo ln -s /usr/local/workspace/blender/blender-2.69-linux-glibc211-x86_64/lib/libGLU.so.1.3.08005 /usr/lib/x86_64-linux-gnu/libGLU.so.1
fi

#Make sure the one final library that Blender requires isn't missing...
sudo apt-get install --yes libXxf86vm-dev

#Create the start/stop script
echo '#! /bin/sh
WORKSPACE=/usr/local/workspace/FORGE/forge/test-server
do_start()
{
        #Startup script of the poor man.  Make this better, someday
        forever start $WORKSPACE/app.js
}
do_stop()
{
        forever stop 0
}
case "$1" in
  start|"")
        do_start
        ;;
  restart|reload|force-reload)
        do_stop
        do_start
        ;;
  stop)
        do_stop
        ;;
  *)
        echo "Usage: forge.sh [start|stop]" >&2
        ;;
esac' > ./forge.sh

#Move the start/stop script and start it!
chmod +x ./forge.sh
sudo cp ./forge.sh /etc/init.d/
sudo /etc/init.d/forge.sh start
