// menu


$(function() {
  $('#toggle').click(function() {
    $(this).toggleClass('active');
    $('#overlay').toggleClass('open');
  });

  $(".slideview").slideview({
    nextButton: '.slideview-next',
    prevButton: '.slideview-prev',
    mouseDragging: false
  });

  var menus = document.querySelectorAll('.overlay-menu a');
  var header = document.querySelector('header');
  var toggle = document.querySelector('#toggle');
  var overlay = document.querySelector('#overlay');
  var counter = 0;
  var current = 0;

  menus.forEach(function(menu, i){
    menu.addEventListener('click', function(e){
      e.preventDefault();
      var id = $(this).attr('href').substr(1);
      changeClass(id);
      setTimeout(function(){
        toggle.classList.remove('active');
        overlay.classList.remove('open');
        console.log('current:', current);
        console.log('i:', i);
        if ( i > current ) {
          triggerSlide(i - current, 'next');
          current = i;
        } else {
          triggerSlide(current - i, 'prev');
          current = i;
        }
      }, 750);
    });
  });
  var slides = $('.slideview-content > div');
  slides.first().addClass('active');
  $('.slideview-next').on('click', function(e){
    if ( !$('.active').is(':last-child') ) {
      $('.active').removeClass('active').next().addClass('active');
      var id = $('.active').attr('id');
      changeClass(id);
      current++;
    }
  });
  $('.slideview-prev').on('click', function(e){
    if (!$('.active').is(':first-child') ) {
      $('.active').removeClass('active').prev().addClass('active');
      var id = $('.active').attr('id');
      changeClass(id);
      current--;
    }
  });

  function changeClass(id) {
    if ( header.classList.value === '' ) {
      header.classList.add(id);
    } else {
      header.classList.value = '';
      header.classList.add(id);
    }
  }

  function triggerSlide(n, direction) {
    for(var i = 0; i < n; i++) {
      if ( direction == 'next') {
        $('.slideview-next').trigger('click');
      } else if ( direction == 'prev' )  {
        $('.slideview-prev').trigger('click');
      }
    }
  }

});
