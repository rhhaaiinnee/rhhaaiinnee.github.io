$(function() {

  new grid3D( document.getElementById( 'grid3d' ) );

  Reveal.initialize({
    width: '100%',
    height: '100%',
    controls: true,
    progress: false,
    history: true,
    transition: 'slide',
    transitionSpeed: 'default',
    backgroundTransition: 'fade'
  });

  $('#toggle').click(function() {
    $(this).toggleClass('active');
    $('#overlay').toggleClass('open');
  });

  var menus = document.querySelectorAll('.overlay-menu a');
  var header = document.querySelector('header');
  var footer = document.querySelector('footer a');
  var toggle = document.querySelector('#toggle');
  var overlay = document.querySelector('#overlay');

  menus.forEach(function(menu, i){
    menu.addEventListener('click', function(e){
      var id = $(this).data('color');
      changeClass(id);
      setTimeout(function(){
        updateArrowPos();
        toggle.classList.remove('active');
        overlay.classList.remove('open');
      }, 750);
    });
  });

  document.querySelector('.navigate-right').addEventListener('click', function(){
    var id = document.querySelector('.present').getAttribute('id');
    changeClass(id);
    updateArrowPos();
  });

  $('.navigate-left').on('click', function(e){
    updateArrowPos()
    var id = document.querySelector('.present').getAttribute('id');
    changeClass(id);

  });

  function changeClass(id) {
    if ( header.classList.value === '' ) {
      header.classList.add(id);
      footer.classList.add(id);
    } else {
      header.classList.value = '';
      footer.classList.value = '';
      header.classList.add(id);
      footer.classList.add(id);
    }
  }

  function updateArrowPos() {
    if ( $('.slides .present').is(':last-child') ) {
      $('.navigate-left').addClass('last-slide');
    } else {
      $('.navigate-left').removeClass('last-slide');
    }
  }

});
