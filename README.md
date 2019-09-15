# SideQuest


[Latest Download](https://sidequestvr.com/#/download) | [Discord](https://discord.gg/pqUz9F7) | [Patreon](https://www.patreon.com/TheExpanseVR) | [Paypal](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=744A6C394Q8JG&source=url)

![Image](https://i.imgur.com/288M0zG.png)



SideQuest is designed to simplify sideloading apps onto your standalone android based headset. It should include everything you need to get started. When you first open the app it is best to open the setup screen and follow the instructions on screen to get set up.

The quest doesnt show 2D apps normally anywhere in the UI. Thankfully though SideQuest has a launcher ( install on the setup screen - scroll down to the bottom ) which appears in the unknown sources list and lets you open 2d apps. You can pick "SideQuest - Home" or "SideQuest - TV" to use the 2D app in the Oculus Home or Oculus TV environments. 

VR apps dont work when launched from the app launcher currently, only 2d apps. The workaround is to launch the VR apps from the unknown sources list instead - they are usually listed there!


## SideQuest Features

-   Automatic download of ADB platform-tools for your platform - win/mac/linux.
-   Automatic download of QuestSaberPatch for your platform - win/mac/linux.
-   Automatic download of songe-converter for your platform - win/mac/linux.
-   Setup instructions for enabling developer mode on your device.
-   AppStarter based app launcher in both Oculus Home and Oculus TV for launching and using 2D apps
-   Drag and drop support for installing arbitrary apk/obb files.
-   File manager with drag and drop support ( thanks Mitch ) 
-   Dark mode
-   New installed apps manager with a backup system.
-   Beat Saber song manager for patching songs onto the Oculus Quest - sorting, multi select, remove duplicates and drag and drop
-   Auto downloading via the in-app browser - now works with beatsaver.com, bsaber.com and also any APK downloads too!


## Setup

[Very Important setup instructions - 5 steps and only takes minutes](https://sidequestvr.com/#/setup-howto)

When you first launch SideQuest it will download the repositories and also download the ADB tools. Once this is done you should go to the Setup menu option and follow through the one time setup to get your device ready to install apps.

If you have any problems you can hit the bug icon on the top right and then open the console tab in that section to capture any errors - these will really help to find and fix bugs.

## Important

Check your antivirus hasn't blocked some parts of the ADB download - this has happened for some with Avast antivirus in particular. 


## Video Tutorial

[![video Tutorial](https://img.youtube.com/vi/HspVa4i9rPg/0.jpg)](https://www.youtube.com/watch?v=HspVa4i9rPg)

('Setup' tab was moved to the 'Setup & How-To' tab, inside the 'Web' tab)

## App Developers: 
We now have a really easy and powerful app manager portal to be able to manage your app listings on SideQuest. 

[Submit Apps To SideQuest](https://github.com/the-expanse/SideQuest/wiki/How-To-Submit-Games)

## Build Steps

Clone the repo. 

To install the app dependencies 
```
yarn install
```

To start the dev stack run 
```
yarn start
```

To build the angular app only
```
yarn app-build
```


To build the electron app only
```
yarn build
yarn build --mac
yarn build --wlm
```

To build the app & angular app
```
yarn dist
```

To re-launch electron if you accidentally close it
```
yarn electron
```

To reset things
```
yarn reset
```

## Contribution Guidelines

We are pretty relaxed at this point, in that we will accept arbitrary PRs, but all collaborators must agree on a way forward. We live by the [Contributor Covenant](https://www.contributor-covenant.org/)

## More Info:

[Oculus Go ADB Driver](https://developer.oculus.com/downloads/package/oculus-go-adb-drivers/)

[Device Setup - Oculus Go - Developer Mode](https://developer.oculus.com/documentation/mobilesdk/latest/concepts/mobile-device-setup-go/)

[OculusQuest subreddit](https://www.reddit.com/r/OculusQuest/)

[OculusGo subreddit](https://www.reddit.com/r/OculusGo)

[Oculus TV subreddit](https://www.reddit.com/r/oculustv/)

[Guide: Launching Android apps in vrshell.desktop instead of Oculus TV](https://www.reddit.com/r/OculusGo/comments/ba6ul9/guide_launching_android_apps_in_vrshelldesktop/)

[Android Subreddit Curated Apps](https://www.reddit.com/r/android/wiki/apps)

[Games that can now be played with Oculus TV as of 1.1.17](https://www.reddit.com/comments/9uney8)

[Oculus TV media app compatibility list](https://www.reddit.com/comments/9x07yj)

## Credits

This program uses code not created by the SideQuest Team these include:

-   [Songe Converter](https://github.com/lolPants/songe-converter) By [@lolPants](https://github.com/lolPants) Licenses can be found [here](https://github.com/the-expanse/SideQuest/blob/master/licenses/songe-converter-license)
-   [QuestSaberPatch](https://github.com/trishume/QuestSaberPatch) By [@trishume](https://github.com/trishume) Licenses can be found [here](https://github.com/the-expanse/SideQuest/blob/master/licenses/QuestSaberPatch-license)
