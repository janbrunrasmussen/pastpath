# pastpath

## Overview

**pastpath** is a local search engine for your browser history. It is primarily addressing 3 things:

- Extending searchable local history beyond 90 days
- Searching in browser history across multiple browsers
- Focus on finding the URL for that repo, docs site or blog that you can only remember small part of

**pastpath** works by collecting browser history from browsers and exposing it through an API and simple frontend.
It can be used as a bookmarked page or as the default page on new tabs (through browser extensions)

<img width="1004" alt="image" src="https://github.com/janbrunrasmussen/pastpath/assets/24657397/dc29b2b2-351a-4a14-9784-6f1e38609041">

## Features

- **Multi-Browser Support**: Collects history from Chrome and Firefox (but can be extended to work with Safari, and Edge).
- **Simple Search Interface**: A simple interface for easy navigation and retrieval of your browsing history, to find _that_ page...
- **Privacy First**: Designed to work locally on your machine, ensuring that your data stays private.
- **Cross-Platform Compatibility**: While developer for macOS, it is cross compilable for any OS and architecuture that [Go supports](https://go.dev/src/go/build/syslist.go)

## Getting Started

## How it works

For **pastpath** to work you need 3 steps (which are described in detail below):

- Get a binary (for now you build it) and put it in an appropriate location
- Define a config file with your browser information
- Make the binary run using your favorite service manager

Then go to the web page and search your history at `http://localhost:10000` (or whatever port you configured).

### Build

Clone the repository and build the binary:

```bash
git clone https://github.com/janbrunrasmussen/pastpath.git
cd pastpath
go build -o pastpath -ldflags "-X main.BuildVersion=$(git rev-parse --short HEAD)"
cp pastpath APPROPRIATE-LOCATION e.g. /usr/local/pastpath
```

### Configure

Add a json configuration file like this one:

```json
{
    "ServerPort": 10000,
    "TmpDir": ".tmp",    
    "InstanceID": "YOUR DEVICE",
    "HistoryProcessingInterval": 600,
    "LocalDBPath": "pastpath.db",
    "Search": {
        "ReplaceHTTPWithHTTPS": true
    },
    "Browsers": [
        {
            "Name": "chrome",
            "Type": "Chrome",
            "HistoryDBPath": "PATH TO HISTORY DB"
        },
        {
            "Name": "firefox",
            "Type": "Firefox",
            "HistoryDBPath": "PATH TO HISTORY DB"
        }
    ]
}
```

**pastpath** looks for `config.json` in the same directory, but any path can be given with `-c / --config` argument.

Only `Browsers` section is required, the other settings have sane default values.
Path to history databases for your OS and browser is easy to find on the web, though some general guidance:

- Chrome on macOS is likely: `/Users/YOUR USER/Library/Application Support/Google/Chrome/Default/History`
- Firefox on macOS is likely: `Users/YOUR USER/Library/Application Support/Firefox/Profiles/YOUR PROFILE/places.sqlite`

### Running the app

**pastpath** can be started by simply executing the binary `./pastpath` optionally with the config argument `-c / --config [config path]`. For it to make sense **pastpath** should be running continuously. In `deployment/macos` is an example of how to wrap it in launchd, with install scripts in the `Makefile`. Similar setup can be done with systemd, Service Control Manager or whatever service manager your OS supports.

## Note on search

The search used is a basic SQL `like` based approach, with each space-separated term appended as it's own like. This has proven to provide fast and reliable results, even if it does not provide a fuzzy search option. Experiments with fzf did not show great potential.

## Roadmap

Items on top of the TODO list:

- Bring your own cloud type backup of **pastpath**'s database
- More OSes
- More browsers
- Integrate bookmarks
- Maybe cross device synchronisation, to allow you to search history from another laptop.

## Contributing

We welcome contributions! If you have an idea for improvement or have found a bug, feel free to fork the repo, create a feature branch, and submit a pull request. Alternatively, open an issue.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
