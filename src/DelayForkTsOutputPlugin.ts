import * as webpack from "webpack";
import * as ForkTsChecker from "fork-ts-checker-webpack-plugin";
import { debounce } from "lodash";

export class DelayForkTsOutputPlugin {
  apply(compiler: webpack.Compiler) {
    const pluginOrderErrorMessage = `
    Something went wrong in accessing the hooks.
    Most likely the order of plugins is wrong.\n
    DelayForkTsOutputPlugin should be placed after FriendlyErrorsWebpackPlugin\n
    and ForkTsCheckerWebpackPlugin\n
  `;
    // detect FriendlyErrorsWebpackPlugin
    if (compiler.hooks) {
      const friendlyErrorsTap = compiler.hooks.done.taps.find(
        (item) => item.name === "FriendlyErrorsWebpackPlugin",
      );
      if (!friendlyErrorsTap) {
        console.error(pluginOrderErrorMessage);
        throw Error(`Error: can not detect FriendlyErrorsWebpackPlugin hooks`);
      }
    } else {
      console.warn(`
        Can not use webpack 4 api to detect
        whether FriendlyErrorsWebpackPlugin is placed before DelayForkTsOutputPlugin
        the output of DelayForkTsOutputPlugin might get overwrite by FriendlyErrorsWebpackPlugin
        Suggest upgrading to webpack 4+
      `);
    }

    // detect ForkTsCheckerWebpackPlugin
    const forkTsPluginInstance = compiler.options.plugins?.find(
      (item) => item.constructor === ForkTsChecker,
    );
    if (!forkTsPluginInstance) {
      console.error(pluginOrderErrorMessage);
      throw Error(`Error: can not detect ForkTsCheckerWebpackPlugin instance`);
    }

    const forkTsStack: Array<{
      type: "info" | "error" | "warn";
      message: string;
    }> = [];

    // 1.create a simple signal of webpack's latest compile behavior.
    let webpackCompilePromise: Promise<any>;
    let webpackCompilePromiseResolve: any;
    const updateWebpackCompilePromise = () => {
      forkTsStack.length = 0;
      webpackCompilePromise = new Promise((resolve) => {
        webpackCompilePromiseResolve = resolve;
      });
    };

    // 2.use lodash.debounc to group sync output, and output them after the latest webpack compile complete.
    const originalLogger: ForkTsChecker.Logger =
      (forkTsPluginInstance as any).logger || console;
    const forkTsLogDebounce = debounce(() => {
      if (!webpackCompilePromise) {
        return;
      }
      webpackCompilePromise.then(() => {
        forkTsStack.forEach((item) => {
          if (item.type === "info") {
            originalLogger.info(item.message);
          }
          if (item.type === "error") {
            originalLogger.error(item.message);
          }
          if (item.type === "warn") {
            originalLogger.warn(item.message);
          }
        });
      });
    }, 100);

    const forkTsDelayLogger: ForkTsChecker.Logger = {
      info: (message) => {
        forkTsStack.push({
          type: "info",
          message,
        });
        forkTsLogDebounce();
      },
      error: (message) => {
        forkTsStack.push({
          type: "error",
          message,
        });
        forkTsLogDebounce();
      },
      warn: (message) => {
        forkTsStack.push({
          type: "warn",
          message,
        });
        forkTsLogDebounce();
      },
    };

    (forkTsPluginInstance as any).logger = forkTsDelayLogger;

    updateWebpackCompilePromise();
    const doneFn = () => {
      if (webpackCompilePromiseResolve) {
        webpackCompilePromiseResolve();
      }
    };
    const invalidFn = () => {
      updateWebpackCompilePromise();
    };

    // 5.listen to compile hook
    if (compiler.hooks) {
      compiler.hooks.done.tap("HyperionCli", doneFn);
      compiler.hooks.invalid.tap("HyperionCli", invalidFn);
      compiler.hooks.compile.tap("HyperionCli", updateWebpackCompilePromise);
    } else {
      compiler.plugin("done", doneFn);
      compiler.plugin("invalid", invalidFn);
      compiler.plugin("compile", updateWebpackCompilePromise);
    }
  }
}
