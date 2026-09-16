export default defineAppConfig({
  ui: {
    // pine / graphite are registered in app/assets/css/main.css's @theme
    // block from design/tokens/palette.css values. Nav menus pass
    // color="neutral" at the call site so plain links don't shout in the
    // brand color — pine (forest green) is for buttons and real accents.
    colors: {
      primary: 'pine',
      neutral: 'graphite'
    }
  }
})
