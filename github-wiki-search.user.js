// ==UserScript==
// @name           Github Wiki Search
// @namespace      github
// @include        https://github.com/*/*/wiki*
// @author         LINYOWS <linyows@gmail.com>
// @require  http://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.min.js
// @description    Search
// ==/UserScript==

// a function that loads jQuery and calls a callback function when jQuery has finished loading
function addJQuery(callback)
{
  var script = document.createElement("script");
  script.setAttribute("src", "http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js");
  script.addEventListener('load', function() {
    var script = document.createElement("script");
    script.textContent = "(" + callback.toString() + ")();";
    document.body.appendChild(script);
  }, false);
  document.body.appendChild(script);
}

// the guts of this userscript
function main()
{
  var msg = 'Search this wiki...';
  var html = '<div id="search-wiki" style="display:inline-block;position:absolute;bottom:10px;right:0;">' +
             '<input type="text" value="'+ msg + '" id="search-words" style="color:#999;padding:3px 2px;"></div>';
  $('.subnav-bar').append(html);

  $(function(){
    $('#search-words').focus(function() {
      if ($(this).val() == msg) { $(this).css('color', '#000').val(''); }
    }).blur(function() {
      if (jQuery.trim($(this).val()) === '') { $(this).css('color', '#999').val(msg); }
    });
    highlightKeyword('#wiki-wrapper');
  });

  // Keyword
  var input_word = '';
  var keywords = [];
  // Target
  var number_of_page = 1;
  var urls_of_page = [];
  var number_of_search = 0;
  var entries = [];
  // Result
  var result_data = [];
  var matched_url = [];
  var cached = false;
  // Pagination
  var current_page = 1;
  var last_page = 1;
  var per_page = 3;

  function hashArgs() {
    var args = {};
    var query = location.href.replace(/.*?#/,"");
    query = decodeURIComponent(query);
    var pairs = query.split("&");
    for (var i = 0; i < pairs.length; i++) {
      var pos = pairs[i].indexOf('=');
      if (pos == -1) continue;
      var argname = pairs[i].substring(0, pos);
      var value = pairs[i].substring(pos + 1);
      args[argname] = value;
    }
    return args;
  }

  function highlightKeyword(div) {
    var args = hashArgs();
    var target_word = args.search_word;
    if (typeof(target_word) == 'undefined') { return; }
    target_word = target_word.replace(/( |　)$/, '');
    if (target_word == '') { return; }
    var target_words = target_word.split(/ |　/);
    for (var i = 0; i < target_words.length; i++) {
      $(div).each(function(){
        var text = $(this).html();
        $(this).html(text.replace(new RegExp(target_words[i], 'ig'), '<em style="background-color:#FAFFA6;padding:0.1em;">' + target_words[i] + '</em>'));
      });
    }
  }

  function initEvent() {
    $('.pagination a').click(function(){
      changePage($(this).attr('rel'));
    });
    $('.pagination span').css('padding', '0.5em 0.7em 0.4em').css('border', '1px solid #AAAADD').css('border-radius', '3px');
    $('.pagination a').css('padding', '0.5em 0.7em 0.4em').css('background-color', '#DDEAF3').css('line-height', '1').css('border-radius', '3px');
    $('.pagination a').hover(function(){
      $(this).css('background-color', '#336699').css('color', '#FFFFFF');
    }, function(){
      $(this).css('background-color', '#DDEAF3').css('color', '#336699');
    });
    $('#close-results > a').click(function(){
      $('#search-words').val('');
      $('#results').fadeOut('slow');
      return false;
    });
    $('#close-results a').hover(function(){
      $(this).css('background-position', '0 -50px');
    }, function(){
      $(this).css('background-position', '0 0');
    });
    $('#results-inner a[href^=#]').click(function() {
      var speed = 400;
      var href= $(this).attr("href");
      var target = $(href == '#' || href === '' ? 'html' : href);
      var position = target.offset().top;
      $($.browser.safari ? 'body' : 'html').animate({scrollTop:position}, speed, 'swing');
      return false;
    });
  }

  function searchResultHtml(result_data) {
    var start_index = (current_page - 1) * per_page;
    var last_index = result_data.length;

    var pagination = '<div style="margin:20px 0px 30px;font-size:14px;font-weight:bold;text-align:center;" class="pagination">';
    if (current_page > 1) {
      pagination+= ' <a href="#results" rel="' + (current_page-1) + '">« Previous</a>';
    }
    for (var i = 0; i < (result_data.length / per_page); i++) {
      pagination+= (i+1 == current_page) ? '<span>' + (i+1) + '</span>' : ' <a href="#results" rel="' + (i+1) + '">' + (i+1) + '</a> ';
    }
    if (current_page < (result_data.length / per_page)) {
      pagination+= ' <a href="#results" rel="' + (current_page-0+1) + '">Next »</a> ';
    }
    pagination+= '</div>';

    var html = '';
    html+= '<ol type=1 start=' + (start_index+1) + ' style="font-size:16px;text-align:left;margin:0;padding:0;list-style-position:inside;font-weight:bold;">';
    if ((current_page * per_page) < result_data.length) { last_index = (current_page) * per_page; }
    for (i = start_index; i < last_index; i++) {
      html+= '<li style="border-bottom:1px solid #ddd;padding: 10px 0 9px;">' +
             '<a href="' + result_data[i].link + '#search_word=' + input_word + '" target="_blank" style="font-size:14px;display:inline-block;padding-bottom:5px;">' +
             highlight(result_data[i].title, keywords) + '</a>' +
             '<span style="font-weight:normal;display:block;padding-left:1.5em;color:#333;font-size:13px;">' +
             highlight(trim(result_data[i].body, keywords[0]), keywords) + '</span></li>';
    }
    html+= '</ol>' + ((number_of_page > 1) ? pagination : '');
    return html;
  }

  function changePage(page) {
    current_page = page;
    $('#results-inner').html(searchResultHtml(result_data));
    initEvent();
  }

  function h(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlight(text, words) {
    var keyword = '';
    var number_of_keyword = words.length;
    for (i = 0; i < number_of_keyword; i++) {
      keyword+= (i == number_of_keyword - 1) ? encodeURIComponent(words[i]) : encodeURIComponent(words[i]) + '|';
    }
    replaced_text = encodeURIComponent(text).replace(new RegExp('(' + keyword + ')', "ig"), '<em style="background-color:#FAFFA6;padding:0.1em;">' + "$1" + '</em>');
    return decodeURIComponent(replaced_text);
  }

  function trim(text, keyword) {
      var key = new RegExp(keyword, "i");
      var res = key.exec(text);
      var total_length = 200;
      if (res) {
        var index  = res.index;
        var length = res[0].length;
        var add_harf_words_length = (total_length - length)/2
        if (add_harf_words_length > index) {
          var start = 0;
          var end = add_harf_words_length + (add_harf_words_length - index);
        } else {
          var start = index - add_harf_words_length;
          var end = add_harf_words_length;
        }
        text = text.substring(start, index) + text.substr(index, length) + text.substr(index + length, end) + '...';
      } else {
        text = text.substring(0, total_length);
      }
      return text;
  }

  function search()
  {
    var progress = 0;

    for (i = number_of_search; i < entries.length; i++) {
      var match = true;
      for (var j = 0; j < keywords.length; j++) {
        var body_index = entries[i].body.toLowerCase().indexOf(keywords[j].toLowerCase());
        var title_index = entries[i].title.toLowerCase().indexOf(keywords[j].toLowerCase());
        if (body_index == -1 && title_index == -1) { match = false; }
      }
      if (match) {
        if (!matched_url[entries[i].link]) {
          result_data[result_data.length] = entries[i];
          matched_url[entries[i].link] = true;
        }
      }
      number_of_search++;
    }

    // No hits
    if (result_data.length == 0) {
      if (number_of_page > urls_of_page.length - 1) {
        $('#progress').css('width', '100%');
        $('#results').find('h3').html('Pages (' + urls_of_page.length + ') / Hits (0)');
        $('#results-inner').html('<div style="font-size:16px;font-weight:bold;color:#CCC;text-align:center;padding:50px 0 70px;">No Results</div>');
        cached = true;
      } else {
        progress = Math.floor((number_of_page * 100 ) / urls_of_page.length);
        $('#progress').css('width', progress + '%');
        $('#results').find('h3').html('Pages (' + urls_of_page.length + ') / Hits (0)');
      }

    // Hits
    } else {
      if (number_of_page > urls_of_page.length - 1) {
        $('#progress').css('width', '100%');
        $('#results').find('h3').html('Pages (' + urls_of_page.length + ') / Hits (' + result_data.length + ')');
        $('#results-inner').html(searchResultHtml(result_data));
        cached = true;
      } else {
        progress = Math.floor((number_of_page * 100 ) / urls_of_page.length);
        $('#progress').css('width', progress + '%');
        $('#results').find('h3').html('Pages (' + urls_of_page.length + ') / Hits (' + result_data.length + ')');
        $('#results-inner').html(searchResultHtml(result_data));
      }
    }
    initEvent();
  }

  function contents(html, link)
  {
    var title = $(html).find('#head').find('h1').html();
    var body = $(html).find('#wiki-content').html();
    body = body.replace(new RegExp('\n', 'g'), '')
               .replace(new RegExp('\f', 'g'), '')
               .replace(new RegExp('\r', 'g'), '')
               .replace(new RegExp('<.*?>', 'ig'), '')
               .replace(/[\s　\t\n\r\"]/g, '')
               .replace(/\"/g, '');
    body = h(body);
    entries[entries.length] = {title:title, body:body, link:link};
    search();
    number_of_page++;
  }

  function pages(html)
  {
    $(html).find('#wiki-content').find('a').each(function(){
      var link = $(this).attr('href');
      $.get(link, function(data){ contents(data, link); });
      urls_of_page[urls_of_page.length] = link;
    });
  }

  function archives()
  {
    if (cached) {
      search();
    } else {
      $('.subnav-bar').find('a').each(function(){
        if ('Pages' == $(this).html()) {
          $.get($(this).attr('href'), function(data){ pages(data); });
        }
      });
    }
  }

  function searchKeyword(text) {
    result_data = [];
    matched_url = [];
    current_page = 1;
    $('#results').remove();
    input_word = text.replace( /( |　)$/, '');
    number_of_search = 0;
    if (input_word == '') { return; }
    var close_image = 'https://a248.e.akamai.net/assets.github.com/images/modules/account/close_pill.png';
    var html = '<div id="results" style="position:relative;">' +
                 '<p id="close-results" style="position:absolute;top:0px;right:0px;width:18px;height:18px;display:block;overflow:hidden;text-indent:-7777em;">' +
                 '<a href="#" style="background:url(' + close_image + ') no-repeat scroll 0 0 transparent;display:block;width:18px;height:18px;">Close</a></p>' +
                 '<h2 style="font-size:20px;font-weight:normal;color:#495961;font-family:Helvetica,arial,freesans,clean,sans-serif;">Search Results</h2>' +
                 '<div id="statusbar" style="background-color:#FAFFA6; border-top: 1px solid #B8D1E3; margin-bottom: 1.3em; overflow: hidden; position:relative;">' +
                   '<div id="progress" style="position:absolute;background-color:#DDEAF3;width:0%;height:100%;"> </div>' +
                   '<h3 style="position:relative;z-index:10;margin:0;padding:0.4em 0.7em;font-size:14px;">Now loading...</h3>' +
                 '</div>' +
                 '<div id="results-inner" style="font-size:12px;line-height:1.5;"></div>' +
               '</div>';
    $('#wiki-wrapper').prepend(html);
    keywords = input_word.split(/ |　/);
    archives();
  }

  $('#search-words').keypress(function (e) {
    if (13 == e.which) { searchKeyword($(this).val()); }
  });
}

// load jQuery and execute the main function
addJQuery(main);
