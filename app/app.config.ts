export default defineAppConfig({
  ui: {
    // rust / graphite are registered in app/assets/css/main.css's @theme
    // block from design/tokens/palette.css values. Nav menus pass
    // color="neutral" at the call site so plain links don't shout in the
    // brand color — rust is for buttons and real accents.
    colors: {
      primary: 'rust',
      neutral: 'graphite'
    }
  }
})
