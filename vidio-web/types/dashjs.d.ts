declare module "dashjs" {
  const dashjs: {
    MediaPlayer: () => {
      initialize: () => void;
      attachSource: (url: string) => void;
      reset: () => void;
    };
  };
  export default dashjs;
}
