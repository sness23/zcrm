cli-app
=================

CLI for Sales


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/cli-app.svg)](https://npmjs.org/package/cli-app)
[![Downloads/week](https://img.shields.io/npm/dw/cli-app.svg)](https://npmjs.org/package/cli-app)


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g cli-app
$ cli-app COMMAND
running command...
$ cli-app (--version)
cli-app/0.0.0 linux-x64 node-v22.20.0
$ cli-app --help [COMMAND]
USAGE
  $ cli-app COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`cli-app hello PERSON`](#cli-app-hello-person)
* [`cli-app hello world`](#cli-app-hello-world)
* [`cli-app help [COMMAND]`](#cli-app-help-command)
* [`cli-app plugins`](#cli-app-plugins)
* [`cli-app plugins add PLUGIN`](#cli-app-plugins-add-plugin)
* [`cli-app plugins:inspect PLUGIN...`](#cli-app-pluginsinspect-plugin)
* [`cli-app plugins install PLUGIN`](#cli-app-plugins-install-plugin)
* [`cli-app plugins link PATH`](#cli-app-plugins-link-path)
* [`cli-app plugins remove [PLUGIN]`](#cli-app-plugins-remove-plugin)
* [`cli-app plugins reset`](#cli-app-plugins-reset)
* [`cli-app plugins uninstall [PLUGIN]`](#cli-app-plugins-uninstall-plugin)
* [`cli-app plugins unlink [PLUGIN]`](#cli-app-plugins-unlink-plugin)
* [`cli-app plugins update`](#cli-app-plugins-update)

## `cli-app hello PERSON`

Say hello

```
USAGE
  $ cli-app hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ cli-app hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/sales/cli-app/blob/v0.0.0/src/commands/hello/index.ts)_

## `cli-app hello world`

Say hello world

```
USAGE
  $ cli-app hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ cli-app hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/sales/cli-app/blob/v0.0.0/src/commands/hello/world.ts)_

## `cli-app help [COMMAND]`

Display help for cli-app.

```
USAGE
  $ cli-app help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for cli-app.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.33/src/commands/help.ts)_

## `cli-app plugins`

List installed plugins.

```
USAGE
  $ cli-app plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ cli-app plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.50/src/commands/plugins/index.ts)_

## `cli-app plugins add PLUGIN`

Installs a plugin into cli-app.

```
USAGE
  $ cli-app plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into cli-app.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the CLI_APP_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the CLI_APP_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ cli-app plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ cli-app plugins add myplugin

  Install a plugin from a github url.

    $ cli-app plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ cli-app plugins add someuser/someplugin
```

## `cli-app plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ cli-app plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ cli-app plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.50/src/commands/plugins/inspect.ts)_

## `cli-app plugins install PLUGIN`

Installs a plugin into cli-app.

```
USAGE
  $ cli-app plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into cli-app.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the CLI_APP_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the CLI_APP_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ cli-app plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ cli-app plugins install myplugin

  Install a plugin from a github url.

    $ cli-app plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ cli-app plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.50/src/commands/plugins/install.ts)_

## `cli-app plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ cli-app plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ cli-app plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.50/src/commands/plugins/link.ts)_

## `cli-app plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ cli-app plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ cli-app plugins unlink
  $ cli-app plugins remove

EXAMPLES
  $ cli-app plugins remove myplugin
```

## `cli-app plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ cli-app plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.50/src/commands/plugins/reset.ts)_

## `cli-app plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ cli-app plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ cli-app plugins unlink
  $ cli-app plugins remove

EXAMPLES
  $ cli-app plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.50/src/commands/plugins/uninstall.ts)_

## `cli-app plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ cli-app plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ cli-app plugins unlink
  $ cli-app plugins remove

EXAMPLES
  $ cli-app plugins unlink myplugin
```

## `cli-app plugins update`

Update installed plugins.

```
USAGE
  $ cli-app plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.50/src/commands/plugins/update.ts)_
<!-- commandsstop -->
