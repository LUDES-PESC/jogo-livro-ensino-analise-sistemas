// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = 'Início';
squiffy.story.id = '68cc77971b';
squiffy.story.sections = {
	'_default': {
		'text': "",
		'attributes': ["sala = 0"],
		'passages': {
		},
	},
	'Início': {
		'clear': true,
		'text': "<p><img src=\"LUDESLOGO.jpg\" width=300/></p>\n<h1 id=\"bem-vindo-visita-livraria-resolve-vers-o-1-2-5-\">Bem Vindo à Visita à Livraria Resolve (Versão 1.2.5)</h1>\n<p>Uma produção do <a href=\"http://ludes.cos.ufrj.br\">Laboratório de Ludologia, Engenharia e Simulação</a> do <a href=\"http://www.cos.ufrj.br\">Programa de Engenharia de Sistemas e Computação</a> da <a href=\"http://coppe.ufrj.br\">COPPE</a>/<a href=\"http://www.ufrj.br\">UFRJ</a>.</p>\n<p>Dica: clique restart no canto superior direito para recarregar. Esse software usa o cache do browser para guardar o estado.</p>\n<p>Você pode:</p>\n<ol>\n<li>Começar o jogo indo para <a class=\"squiffy-link link-section\" data-section=\"Porta de Entrada\" role=\"link\" tabindex=\"0\">Livraria Resolve</a>.</li>\n<li>Entender mais sobre esse <a class=\"squiffy-link link-passage\" data-passage=\"site\" role=\"link\" tabindex=\"0\">site</a>.</li>\n<li>Saber sobre as <a class=\"squiffy-link link-passage\" data-passage=\"pegadinhas\" role=\"link\" tabindex=\"0\">pegadinhas</a>.</li>\n<li>Ver os <a class=\"squiffy-link link-section\" data-section=\"Créditos\" role=\"link\" tabindex=\"0\">Créditos</a></li>\n</ol>",
		'passages': {
			'site': {
				'text': "<h2 id=\"o-que-esse-site-jogo-\">O que é esse site-jogo?</h2>\n<p>Nesse livro-jogo eletrônico você é um analista de sistemas que vai elicitar requisitos na <a class=\"squiffy-link link-section\" data-section=\"Porta de Entrada\" role=\"link\" tabindex=\"0\">Livraria Resolve</a>. </p>\n<p>Basicamente você precisa levantar os dados necessários para propor um sistema para a Livraria Resolve. Nas conversas você vai descobrir qual o sistema e quais funcionalidades ele precisa.</p>\n<p>Na versão atual, você vai conseguir levantar toda a informação necessária, no futuro isso não será verdade, vai depender da sua interação e também das suas perguntas.</p>\n<p>Elicitar requisitos é investigar. Não deixe de ler nada. Às vezes é necessário voltar o texto com a barra de rolamento para fazer outra pergunta.</p>\n<p>Para conhecer a Livraria Resolve, você tem que ir até <a class=\"squiffy-link link-section\" data-section=\"Porta de Entrada\" role=\"link\" tabindex=\"0\">ela</a>.</p>",
			},
			'pegadinhas': {
				'text': "<h2 id=\"cuidado-com-as-pegadinhas\">Cuidado com as &quot;pegadinhas&quot;</h2>\n<p>Nessa história, foram feitas adaptações de um problema &quot;exato&quot; para um problema mais parecido ao mundo real:</p>\n<ol>\n<li>A descrição a seguir tenta manter um nível ainda inicial, mas mostrar alguns problemas típicos da elicitação de requisitos:</li>\n<li>Nem todo entrevistado diz tudo o que faz na primeira pergunta.</li>\n<li>Alguns casos de uso ficam “escondidos” em uma palavra ou sentença que parece ter pouca importância.</li>\n<li>Termos diferentes são usados por entrevistados para significar a mesma coisa.</li>\n<li>Alguns entrevistados falam de uma parte (ou de alguns objetos) de um caso de uso que outro entrevistado não falou.</li>\n<li>Usuário de mais alto nível na empresa muitas vezes não citam partes importantes do processo.</li>\n<li>Algumas coisas que a empresa não quer que aconteça, acontecem.</li>\n</ol>\n<h2 id=\"aten-o\">Atenção</h2>\n<p>Algumas vezes, devido ao software usado, você pode ter que voltar para a entrada de uma sala, rolando a tela, para poder continuar a jogar.</p>\n<p>Veja os <a class=\"squiffy-link link-section\" data-section=\"Créditos\" role=\"link\" tabindex=\"0\">Créditos</a> ou volte para o <a class=\"squiffy-link link-section\" data-section=\"Início\" role=\"link\" tabindex=\"0\">início</a>.</p>",
			},
		},
	},
	'Créditos': {
		'clear': true,
		'text': "<h1 id=\"cr-ditos\">Créditos</h1>\n<p>Volte para o <a class=\"squiffy-link link-section\" data-section=\"Início\" role=\"link\" tabindex=\"0\">início</a>.</p>\n<p>Feito com  Squiffy 5.1.1 Build 5.1.3)</p>\n<h2 id=\"autor\">Autor</h2>\n<p><a href=\"http://xexeo.net\">Geraldo Xexéo</a></p>\n<h2 id=\"produ-o\">Produção</h2>\n<p><a href=\"http://ludes.cos.ufrj.br\">LUDES - Laboratório de Ludologia, Engenharia e Simulação</a></p>\n<h2 id=\"inspirado-em-problema-original-criado-ou-modificado-por\">Inspirado em problema original criado ou modificado por</h2>\n<ul>\n<li>Blaschek</li>\n<li>Vera Werneck</li>\n</ul>\n<h2 id=\"agradecimentos-pelos-testes\">Agradecimentos pelos testes</h2>\n<ul>\n<li>Débora</li>\n<li>Luis Fernando</li>\n</ul>\n<h2 id=\"imagens\">Imagens</h2>\n<ul>\n<li>Logo da livraria criado pelo autor no site da Wix</li>\n</ul>",
		'passages': {
		},
	},
	'Porta de Entrada': {
		'clear': true,
		'text': "<h1 id=\"porta-de-entrada\">Porta de Entrada</h1>\n<p>Você <em>finalmente</em> conseguiu passar pelo engarrafamento matinal e chegar a Livraria Resolve. </p>\n<p>O logo na porta deixa claro que você chegou no lugar certo.</p>\n<p><img src=\"Logo.png\"/></p>\n<p>Antes de bater na porta, você pega seu celular e verifica suas anotações sobre com quem deve se encontrar:</p>\n<table>\n<tr><td>Cliente</td><td> Livraria Resolve</td></tr>\n<tr><td>Proprietário  </td><td> Arnaldo Américo</td></tr>\n<tr><td>Gerente Geral </td><td> Bruna Belítro</td></tr>\n<tr><td>Gerente de TI </td><td> Carlos Castelo</td></tr>\n<tr><td>Pedido</td><td> web site de atendimento a clientes </td></tr>\n</table>\n\n<p>Na porta, que parece muito resistente, tem uma placa com o nome da livraria.</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Você toca a campainha\" role=\"link\" tabindex=\"0\">Você toca a campainha</a> ou <a class=\"squiffy-link link-passage\" data-passage=\"Você bate na porta\" role=\"link\" tabindex=\"0\">você bate na porta</a>.</p>",
		'passages': {
			'Você bate na porta': {
				'text': "<p>Você bate na porta, mas ela é muito grossa. Não parece que ninguém ouviu nada.</p>\n<p>O que você acha de <a class=\"squiffy-link link-passage\" data-passage=\"Você toca a campainha\" role=\"link\" tabindex=\"0\">tocar a campainha</a>?</p>",
			},
			'Você toca a campainha': {
				'text': "<p>A campainha toca uma música conhecida, mas você não sabe qual. Depois de uns quinze segundos uma moça de uns 25 anos, com um sorriso simpático e uniforme profissional, abre a porta e pergunta:</p>\n<ul>\n<li>Em que posso ajudar?</li>\n</ul>\n<p><a class=\"squiffy-link link-section\" data-section=\"Recepcao\" role=\"link\" tabindex=\"0\">Você explica que é o analista de sistemas que veio começar o serviço do novo sistema</a>.</p>",
			},
		},
	},
	'Porta2': {
		'text': "<h1 id=\"porta-de-entrada\">Porta de Entrada</h1>\n<p>Nossa!</p>\n<p>Você está assustado com seu primeiro trabalho. </p>\n<p>É melhor tomar um ar, respirar fundo, criar coragem e <a class=\"squiffy-link link-passage\" data-passage=\"tocar a campainha de novo\" role=\"link\" tabindex=\"0\">tocar a campainha de novo</a>.</p>",
		'passages': {
			'tocar a campainha de novo': {
				'text': "<p>A campainha toca a mesma música conhecida. Rapidamente a Débora Dina abre a porta de novo.</p>\n<ul>\n<li>Você voltou? O que houve?</li>\n</ul>\n<p>Você explica que precisou tomar um ar, pois é seu primeiro trabalho sozinho.</p>\n<p>Ela diz:</p>\n<ul>\n<li>Não se assuste, aqui dentro basta ser educado que todos são simpáticos.</li>\n</ul>\n<p><a class=\"squiffy-link link-section\" data-section=\"Recepcao\" role=\"link\" tabindex=\"0\">Melhor entrar de novo.</a>.</p>",
			},
		},
	},
	'Recepcao': {
		'text': "<h1 id=\"recep-o\">Recepção</h1>\n<p>A moça diz:</p>\n<p>{if not seen Porta2:</p>\n<ul>\n<li>Bom dia, entre por favor. Eu sou a <strong>Débora Dina</strong>, a recepcionista, você tem várias reuniões marcadas aqui, hoje. Entre por favor e sente, vou anunciá-lo.\n}{else:</li>\n<li>Bem, é melhor você tomar um copo de água - diz Débora oferecendo um copo com água e duas pedras de gelo.</li>\n</ul>\n<p>Você agradece, bebe a água devagar e se sente mais calmo.</p>\n<p>Ela diz:</p>\n<ul>\n<li>Dessa vez não vai fugir. Espere um pouco.\n}</li>\n</ul>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Você senta no sofá\" role=\"link\" tabindex=\"0\">Você senta no sofá</a>, <a class=\"squiffy-link link-passage\" data-passage=\"senta na poltrona\" role=\"link\" tabindex=\"0\">senta na poltrona</a> ou <a class=\"squiffy-link link-passage\" data-passage=\"olha ao seu redor\" role=\"link\" tabindex=\"0\">olha ao seu redor</a>.</p>",
		'passages': {
			'senta na poltrona': {
				'text': "<p>Você pensa em se sentar na poltrona, mas ela não parece confortável. É moderna e cheia de pontas. Melhor sentar em outro lugar, como no <a class=\"squiffy-link link-passage\" data-passage=\"Você senta no sofá\" role=\"link\" tabindex=\"0\">sofá</a>, ou simplemente ficar em pé e olhar ao <a class=\"squiffy-link link-passage\" data-passage=\"olha ao seu redor\" role=\"link\" tabindex=\"0\">redor</a>.</p>",
			},
			'olha ao seu redor': {
				'text': "<p>Você vê um <a class=\"squiffy-link link-passage\" data-passage=\"Você senta no sofá\" role=\"link\" tabindex=\"0\">sofá</a>, uma <a class=\"squiffy-link link-passage\" data-passage=\"senta na poltrona\" role=\"link\" tabindex=\"0\">poltrona</a> e a Débora Dina. Em cada parede há um cartaz, enquadrado, com a propaganda de um livro. Você percebe que já leu um deles e gostou muito. Há uma {if not seen Porta2: <a class=\"squiffy-link link-passage\" data-passage=\"a porta principal\" role=\"link\" tabindex=\"0\">a porta principal</a>}{else: a porta principal}, de madeira e muito grossa, e uma <a class=\"squiffy-link link-passage\" data-passage=\"porta menor\" role=\"link\" tabindex=\"0\">porta menor</a>, que parece dar para dentro da empresa. Débora está falando no telefone com alguém.</p>",
			},
			'a porta principal': {
				'text': "<p>Você fica assustado com o serviço, não sabe se vai dar conta, e sai correndo pela <a class=\"squiffy-link link-section\" data-section=\"Porta2\" role=\"link\" tabindex=\"0\">Porta de Entrada</a>.</p>",
			},
			'porta menor': {
				'text': "<p>Você se dirige a porta menor, mas Débora se coloca a sua frente e diz:</p>\n<ul>\n<li>Você deve esperar um pouco, é mais confortável esperar no <a class=\"squiffy-link link-passage\" data-passage=\"Você senta no sofá\" role=\"link\" tabindex=\"0\">sofá</a>, por favor, a poltrona é mais um enfeite. </li>\n</ul>",
			},
			'Você senta no sofá': {
				'text': "<p>Depois de cinco minutos, Débora pede para você seguir pela porta e ir para a última porta do <a class=\"squiffy-link link-section\" data-section=\"corredor\" role=\"link\" tabindex=\"0\">corredor</a>, marcada como sala de reuniões. Quando estiver pronto para sair, volte a recepção, é o único caminho.</p>",
			},
		},
	},
	'corredor': {
		'text': "<h1 id=\"corredor\">Corredor</h1>\n<p>Você está no corredor. Você vê várias portas com identificação: </p>\n<ul>\n<li>a {if seen sala de reuniões:<a class=\"squiffy-link link-passage\" data-passage=\"sala2\" role=\"link\" tabindex=\"0\">sala de reuniões</a>}{else: <a class=\"squiffy-link link-section\" data-section=\"sala de reuniões\" role=\"link\" tabindex=\"0\">sala de reuniões</a>};\n{if not seen sala de reuniões:</li>\n<li>sala de TI;</li>\n<li>sala dos vendedores, e</li>\n<li>sala da gerência.}\n{else:</li>\n<li>a {if seen sala da gerência:<a class=\"squiffy-link link-passage\" data-passage=\"sala4\" role=\"link\" tabindex=\"0\">sala da gerência</a>}{else: <a class=\"squiffy-link link-section\" data-section=\"sala da gerência\" role=\"link\" tabindex=\"0\">sala da gerência</a>};</li>\n<li>a {if seen sala dos vendedores:<a class=\"squiffy-link link-passage\" data-passage=\"sala5\" role=\"link\" tabindex=\"0\">sala dos vendedores</a>}{else: <a class=\"squiffy-link link-section\" data-section=\"sala dos vendedores\" role=\"link\" tabindex=\"0\">sala dos vendedores</a>, e}.</li>\n<li>a {if seen sala de TI:<a class=\"squiffy-link link-passage\" data-passage=\"sala3\" role=\"link\" tabindex=\"0\">sala de TI</a>}{else: <a class=\"squiffy-link link-section\" data-section=\"sala de TI\" role=\"link\" tabindex=\"0\">sala de TI</a>}.\n}</li>\n</ul>\n<p>{if @salas=4:Bem, parece que seu trabalho está feito. Volte para a <a class=\"squiffy-link link-section\" data-section=\"saida\" role=\"link\" tabindex=\"0\">recepção</a>}</p>",
		'passageCount': 4,
		'passages': {
			'@last': {
				'text': "<p>Bem, parece que seu trabalho está feito. Volte para a <a class=\"squiffy-link link-section\" data-section=\"saida\" role=\"link\" tabindex=\"0\">recepção</a></p>",
			},
			'sala2': {
				'text': "<h1 id=\"sala-de-reuni-es-de-novo\">Sala de Reuniões, de novo</h1>\n<p>A sala de reuniões ficou vazia, para que o Sr. Arnaldo Américo saiu pela outra porta. </p>\n<p>Volte para o <a class=\"squiffy-link link-section\" data-section=\"corredor\" role=\"link\" tabindex=\"0\">corredor</a>.</p>",
			},
			'sala3': {
				'text': "<h1 id=\"sala-de-ti-de-novo\">Sala de TI, de novo</h1>\n<p>O Carlos parece muito ocupado agora, está com a cabeça enfiada atrás do rack e mexendo em muitos fios. Melhor não atrapalhar.</p>\n<p>Volte para o <a class=\"squiffy-link link-section\" data-section=\"corredor\" role=\"link\" tabindex=\"0\">corredor</a>.</p>",
			},
			'sala4': {
				'text': "<h1 id=\"sala-de-ger-ncia-de-novo\">Sala de Gerência, de novo</h1>\n<p>Armando e Bruna estão conversando em cima de papéis e usando calculadoras. Não parece a hora de interromper, eles estão muito concentrados.</p>\n<p>Volte para o <a class=\"squiffy-link link-section\" data-section=\"corredor\" role=\"link\" tabindex=\"0\">corredor</a>.</p>",
			},
			'sala5': {
				'text': "<h1 id=\"sala-dos-vendedores-de-novo\">Sala dos vendedores, de novo</h1>\n<p>Eles estão novamente no telefone. Não dá para interromper de novo.</p>\n<p>Volte para o <a class=\"squiffy-link link-section\" data-section=\"corredor\" role=\"link\" tabindex=\"0\">corredor</a>.</p>",
			},
		},
	},
	'sala de reuniões': {
		'text': "<h1 id=\"sala-de-reuni-es\">Sala de Reuniões</h1>\n<ul>\n<li>Bem vindo, você chegou! Estava esperando ansioso. Serão grandes mudanças.</li>\n</ul>\n<p>Quem fala é um senhor calvo, de uns 70 anos, óculos redondos grossos, de terno cinza e gravata clara. Quase o estereótipo de um livreiro. </p>\n<ul>\n<li>Eu sou <strong>Arnaldo Américo</strong>, proprietário da Livraria Resolve. Espero que você possa nos ajudar com nosso problema. A gente precisa de alguém que resolva!</li>\n</ul>\n<p>Ele parece feliz com o trocadilho, você tenta fingir um sorriso.</p>\n<p>Você: <a class=\"squiffy-link link-passage\" data-passage=\"olha\" role=\"link\" tabindex=\"0\">olha</a> ao redor, <a class=\"squiffy-link link-passage\" data-passage=\"cumprimenta\" role=\"link\" tabindex=\"0\">cumprimenta</a> o Sr. Arnaldo, ou se <a class=\"squiffy-link link-passage\" data-passage=\"senta\" role=\"link\" tabindex=\"0\">senta</a> na mesa de reunião?</p>",
		'attributes': ["salas+=1"],
		'passages': {
			'olha': {
				'text': "<p>A sala é ampla, contém uma mesa de reuniões com 12 lugares e boa iluminação, um quadro branco em uma parede, uma tela de projeção em outra. Há uma aparedeira com água e café. Papéis e lápis estão sobre a mesa. Há uma outra porta com a placa <em>privativo do diretor</em>. Parece que você não pode passar por ela.</p>\n<p>Vendo a sala, você <a class=\"squiffy-link link-passage\" data-passage=\"cumprimenta\" role=\"link\" tabindex=\"0\">cumprimenta</a> o Sr. Arnaldo, ou se <a class=\"squiffy-link link-passage\" data-passage=\"senta\" role=\"link\" tabindex=\"0\">senta</a> na mesa de reunião?</p>",
			},
			'senta': {
				'text': "<p>{if seen cumprimenta: Você se senta na mesa de reunião e o Sr Arnaldo Américo senta na posição oposta a sua}{else: Você se senta na mesa sem falar nada. O Sr. Arnaldo Américo faz uma cara esquisita, mas senta na posição oposta a sua.}</p>\n<p>Você acha que está na hora de começar a fazer <a class=\"squiffy-link link-section\" data-section=\"pergunta\" role=\"link\" tabindex=\"0\">perguntas</a>{if not seen cumprimenta:, ou você <a class=\"squiffy-link link-passage\" data-passage=\"cumprimenta\" role=\"link\" tabindex=\"0\">cumprimenta</a> o Sr. Arnaldo?}{else:.}</p>",
			},
			'cumprimenta': {
				'text': "<p>{if seen senta: O Sr. Arnaldo Américo faz uma cara de aliviado}</p>\n<p>Você diz:</p>\n<ul>\n<li>Olá, eu sou o analista responsável pelo seu novo sistema. É um prazer está aqui. </li>\n</ul>\n<p>Você trocam trocam um aperto de mãos.</p>\n<p>{if seen senta: Você pensa novamente em começar as <a class=\"squiffy-link link-section\" data-section=\"pergunta\" role=\"link\" tabindex=\"0\">perguntas</a>.}</p>\n<p>{if not seen senta: o Sr. Arnaldo Américo o convida para <a class=\"squiffy-link link-passage\" data-passage=\"senta\" role=\"link\" tabindex=\"0\">sentar</a>.}</p>",
			},
		},
	},
	'pergunta': {
		'text': "<h1 id=\"a-reuni-o-com-arnaldo-am-rico-propriet-rio\">A Reunião com Arnaldo Américo, proprietário</h1>\n<p>O Sr. Arnaldo Américo parece perceber sua hesitação e começa a falar:</p>\n<ul>\n<li>Por onde podemos <a class=\"squiffy-link link-passage\" data-passage=\"começar\" role=\"link\" tabindex=\"0\">começar</a>? A empresa está crescendo e é hora de informatizar. Já reservei um dinheiro para esse projeto e outros mais.</li>\n</ul>",
		'passageCount': 8,
		'passages': {
			'começar': {
				'text': "<p>{if not começou:\nVocê explica:</p>\n<ul>\n<li>Bem, eu tenho algumas perguntas para o senhor e para todos na empresa. \n}</li>\n</ul>\n<p>Você decide, sobre o que quer saber? </p>\n<ol>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"problema\" role=\"link\" tabindex=\"0\">Por que</a> o senhor chamou a minha empresa?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"empresa\" role=\"link\" tabindex=\"0\">O que</a> sua empresa faz?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"atendimento\" role=\"link\" tabindex=\"0\">Como</a> os pedidos são atendidos?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"entrevistar\" role=\"link\" tabindex=\"0\">Quem</a> mais eu posso entrevistar?</li>\n</ol>",
			},
			'@last': {
				'text': "<p>Se quiser, pode perguntar <a class=\"squiffy-link link-passage\" data-passage=\"começar\" role=\"link\" tabindex=\"0\">mais alguma coisa</a>, se não é melhor <a class=\"squiffy-link link-section\" data-section=\"fimdono\" role=\"link\" tabindex=\"0\">se despedir</a>.</p>",
			},
			'problema': {
				'text': "<p>Nossa empresa precisa mudar. Não dá para continuar como está. Tudo é muito atrasado. Meu filho acha que eu sou velho, mas eu sei que temos que ter atendimento via internet.</p>\n<p>Eu quero que você escute todos e faça um software que apoio o pessoal de vendas para vender por internet. Depois fazemos o resto. Já estamos perdendo clientes.</p>\n<p>Mas lembre sempre que nós somos uma empresa com pouco estoque, negociamos com livros muito caros e quase sempre raros. </p>\n<p>Eu quero vender esses livros raros via internet.</p>\n<p>Creio que meu filho ficaria surpreso se me ouvisse falar!</p>\n<ol>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"empresa\" role=\"link\" tabindex=\"0\">O que</a> sua empresa faz?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"atendimento\" role=\"link\" tabindex=\"0\">Como</a> os pedidos são atendidos?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"entrevistar\" role=\"link\" tabindex=\"0\">Quem</a> mais eu posso entrevistar?</li>\n</ol>",
				'attributes': ["começou"],
			},
			'empresa': {
				'text': "<p>O Sr. Arnaldo parece feliz em falar de sua empresa:</p>\n<ul>\n<li>Eu que fundei essa livraria, 30 anos atrás. A Livraria Resolve atua no mercado de venda de livros de arte e livros raros, de colecionadores, sob encomenda. </li>\n</ul>\n<p>Ele continua...</p>\n<ul>\n<li><p>Nossa atuação não prevê a manutenção de livros em estoque, apesar de alguns acabarem ficando no estoque por problemas na venda. Todos os livros solicitados por nossos clientes são, semanalmente, encomendados às editoras, distribuidoras, outras livrarias e outros vendedores em geral. Nós somos uma espécie de empresa de corretagem, que facilita a vida de colecionadores.</p>\n</li>\n<li><p>Você quer saber mais <a class=\"squiffy-link link-passage\" data-passage=\"funciona\" role=\"link\" tabindex=\"0\">como a livraria funciona</a>?</p>\n</li>\n</ul>",
				'attributes': ["começou"],
			},
			'funciona': {
				'text': "<p>Você pede para ele continuar:</p>\n<ul>\n<li><p>O cliente pode pedir qualquer livro, mas nós não trabalhamos com livros comuns. Nosso mercado é restrito e de alto valor agregado. Trabalhamos com livros do mundo todo e temos contatos em todos os lugares. Até no Nepal. A partir do pedido do cliente, a gente investiga se o livro pode ser encontrado e trazido para o Brasil.</p>\n</li>\n<li><p>Um livro raro pode ser uma primeira edição antiga, um livro mesmo moderno mas de tiragem muito pequena, alguns livros de arte, design e arquitetura. Muitos desses livros saíram de catálogo.</p>\n</li>\n<li><p>Para usar os serviços da livraria, os clientes devem se cadastrar previamente. O pedido de cadastro é aprovado por mim ou por meu filho, Armando Américo. </p>\n</li>\n<li><p>Temos clientes no mundo todo. O cadastro básico é composto de nome, endereço completo, telefone fixo, telefone celular, telefone profissional, e email.</p>\n</li>\n</ul>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"clientes\" role=\"link\" tabindex=\"0\">Ele parece animado contando a história da empresa...</a></p>",
				'attributes': ["começou"],
			},
			'clientes': {
				'text': "<p>O dono da empresa continua a falar, realmente sem dar chance para interrupções:</p>\n<ul>\n<li><p>Os clientes enviam seus pedidos pelo correio eletrônico, telefone ou fax, ainda temos um fax! O pedido é aceito se o cliente estiver previamente cadastrado. Caso contrário, o pedido é rejeitado com um aviso ao solicitante para se cadastrar, o que volta pelo mesmo sistema. </p>\n</li>\n<li><p>Isso é importante, pois nós normalmente pagamos os livros antes de receber por eles e são livros caros. Nas sextas-feiras, a livraria emite requisições de livros para os fornecedores que escolhemos, ou seja, fecha os negócios combinados, com base nos pedidos recebidos e no que encontramos na internet.</p>\n</li>\n<li><p>Quando os livros são entregues pelo fornecedor, a livraria confere a nota de entrega da editora com a requisição, devolvendo as que contiverem erros. </p>\n</li>\n</ul>\n<p>Você pode perguntar ainda:</p>\n<ol>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"problema\" role=\"link\" tabindex=\"0\">Por que</a> o senhor chamou a minha empresa?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"atendimento\" role=\"link\" tabindex=\"0\">Como</a> os pedidos são atendidos?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"entrevistar\" role=\"link\" tabindex=\"0\">Quem</a> mais eu posso entrevistar?</li>\n</ol>",
			},
			'atendimento': {
				'text': "<p>O Sr. Arnaldo explica:</p>\n<ul>\n<li><p>Os pedidos dos clientes são atendidos imediatamente quando completos, isto é, quando todos os livros pedidos foram enviados pelos fornecedores escolhidos por nós (ou forem cancelados). </p>\n</li>\n<li><p>O atendimento, que é a entrega pelo correio, consiste na emissão de uma instrução  de pagamento, que é pago, e depois de uma nota fiscal, que é enviada então com o livro. Cópias da nota fiscal e do boleto são enviadas ao nosso contador, que é terceirizado. </p>\n</li>\n<li><p>Para os clientes no Brasil, podemos emitir também um boleto bancário. Para clientes no exterior são apenas os dados de nossa conta bancária no Brasil, para onde eles devem fazer um depósito internacional. </p>\n</li>\n</ul>\n<p>Você então pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"cancelado\" role=\"link\" tabindex=\"0\">Como</a> um livro pode ser cancelado?</li>\n</ul>",
				'attributes': ["começou"],
			},
			'cancelado': {
				'text': "<p>E o Sr. Arnaldo responde:</p>\n<ul>\n<li>Se depois de 30 dias da data de entrega o fornecedor não enviou um livro requisitado, a livraria cancela o pedido junto ao fornecedor e elimina o livro do pedido do cliente. É enviado um aviso ao cliente desse fato, junto com o restante do pedido, se existir, ou isoladamente pelo correio. Nós também avisamos ao fornecedor que não queremos mais o livro.</li>\n</ul>\n<p>Você ainda pode perguntar:</p>\n<ol>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"problema\" role=\"link\" tabindex=\"0\">Por que</a> o senhor chamou a minha empresa?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"empresa\" role=\"link\" tabindex=\"0\">O que</a> sua empresa faz?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"entrevistar\" role=\"link\" tabindex=\"0\">Quem</a> mais eu posso entrevistar?</li>\n</ol>",
			},
			'entrevistar': {
				'text': "<p>O Sr. Arnaldo parece pensar e fala:</p>\n<ul>\n<li><p>Somos poucos, mas trabalhamos muito aqui - diz o Sr. Arnaldo com orgulho - Você ainda pode entrevistar:</p>\n<ol>\n<li>Meu filho, Armando Américo, que é o diretor.</li>\n<li>Minha grande amiga de infância, Bruna Berílio, que é gerente geral.</li>\n<li>O vendedor, Felipe Franciscano, que fica na sala de vendas.</li>\n<li>Outra vendedora, há muito tempo na empresa, Gabriela Gambra. </li>\n<li>O gerente de TI, programador e faz-tudo de informática, Carlos Castelo.</li>\n</ol>\n</li>\n</ul>\n<p>Você vê que ainda dá tempo de outra pergunta:</p>\n<ol>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"problema\" role=\"link\" tabindex=\"0\">Por que</a> o senhor chamou a minha empresa?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"empresa\" role=\"link\" tabindex=\"0\">O que</a> sua empresa faz?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"atendimento\" role=\"link\" tabindex=\"0\">Como</a> os pedidos são atendidos?</li>\n</ol>",
				'attributes': ["começou"],
			},
		},
	},
	'fimdono': {
		'text': "<p>Você fica bastante satisfeito com as informações que tem até agora e agradece ao dono da empresa. </p>\n<p>Ele responde:</p>\n<p>Acho que você já pode entrevistar as outras pessoas. Até logo. Ele se vira para sair, mas não resiste e diz para você:\n{if not seen cumprimenta: É melhor você se apresentar para os outros, é muito esquisito falar com alguém que não se conhece.}{else: Você é uma pessoa simpática, eles vão gostar de você.}</p>\n<p>Parece que você já investigou tudo. Levantou ótimas informações.</p>\n<p>Você se despede educadamente e segue para o <a class=\"squiffy-link link-section\" data-section=\"corredor\" role=\"link\" tabindex=\"0\">corredor</a>?</p>",
		'passages': {
		},
	},
	'sala de TI': {
		'text': "<h1 id=\"sala-de-ti\">Sala de TI</h1>\n<p>Você chega na Sala de TI e vê um homem agitado tentando colocar um computador em um rack, mas meio sem jeito. Ele pede sua ajuda com um olhar. Com certeza é o <strong>Carlos Castelo</strong>.</p>\n<p>Você <a class=\"squiffy-link link-passage\" data-passage=\"ajuda\" role=\"link\" tabindex=\"0\">ajuda</a>, levantando o rack um pouco para entrar na posição, ou você <a class=\"squiffy-link link-passage\" data-passage=\"finge\" role=\"link\" tabindex=\"0\">finge</a> que não viu.</p>",
		'attributes': ["salas+=1","humor = 0"],
		'passages': {
			'ajuda': {
				'text': "<p>{if seen finge: agora não adianta mais... Castelo parece de mau humor}\n{else:\nVocê dá uma pequena ajuda para Carlos Castelo, ajudando a encaixar o computador. Ele fica muito feliz e se apresenta:</p>\n<ul>\n<li>Olá, sou o Carlos, você foi de muita ajuda, não estava conseguindo acertar, em que posso te ajudar como agradecimento?</li>\n</ul>\n<p>}</p>\n<p>Você se <a class=\"squiffy-link link-passage\" data-passage=\"apresenta\" role=\"link\" tabindex=\"0\">apresenta</a> ou já diz logo o que <a class=\"squiffy-link link-passage\" data-passage=\"quer\" role=\"link\" tabindex=\"0\">quer</a>?</p>",
				'attributes': ["humor+=1"],
			},
			'finge': {
				'text': "<p>{if seen ajuda: sua ajuda foi bem-vinda, não precisa mais fingir.}\n{else:</p>\n<p>Ele consegue colocar o computador no lugar com muito esforço.\nO homem parace mal humorado.</p>\n<ul>\n<li>Olá, sou o Sr. Castelo. O que você está fazendo aqui?\n}</li>\n</ul>\n<p>Você se <a class=\"squiffy-link link-passage\" data-passage=\"apresenta\" role=\"link\" tabindex=\"0\">apresenta</a> ou diz o que <a class=\"squiffy-link link-passage\" data-passage=\"quer\" role=\"link\" tabindex=\"0\">quer</a>?</p>",
				'attributes': ["humor-=1"],
			},
			'apresenta': {
				'text': "<p>Você se apresenta, diz que é responsável pela análise do novo sistema de informação da empresa, e precisa saber se há alguma demanda que ele pode <a class=\"squiffy-link link-section\" data-section=\"explicar\" role=\"link\" tabindex=\"0\">explicar</a>.</p>",
				'attributes': ["humor+=1"],
			},
			'quer': {
				'text': "<p>{if not seen apresenta: Você diz que quer algumas <a class=\"squiffy-link link-section\" data-section=\"explicar\" role=\"link\" tabindex=\"0\">explicações</a> e ele dá um suspiro\n}</p>",
				'attributes': ["humor-=1"],
			},
		},
	},
	'explicar': {
		'text': "<p>{if humor=2:Carlos Castelo está muito bem humorado}\n{if humor=1:Carlos Castelo está bem  humorado}\n{if humor=0:Carlos Castelo está com cara de cansado}\n{if humor=-1:Carlos Castelo está mal humorado}\n{if humor=-2:Carlos Castelo está muito mal humorado}</p>\n<ul>\n<li>Vamos lá, o que você quer saber - ele diz.</li>\n</ul>\n<p>Você explica que está interessado em:</p>\n<ol>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"recomendacoes\" role=\"link\" tabindex=\"0\">Como</a> deve funcionar o sistema?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"onde\" role=\"link\" tabindex=\"0\">Onde</a> ele vai executar?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"Quais\" role=\"link\" tabindex=\"0\">Quais</a> softwares que deve usar.</li>\n</ol>",
		'passageCount': 4,
		'passages': {
			'onde': {
				'text': "<p>Castelo começa a contar:</p>\n<ul>\n<li>Nós decidimos terceirizar tudo para a nuvem, é muito caro manter um servidor local para aplicações, o melhor é alugar mesmo. Já basta essas duas máquinas para a nossa aplicação de ERP funcionar.</li>\n</ul>\n<p>Ele olha para a própria mão, parece que arranhou ao instalar a máquina, e continua.</p>\n<ul>\n<li>É essencial que tudo seja feito usando software livre e rodando no sistema Linux Ubuntu.</li>\n</ul>\n<p>Você ainda pode querer saber:</p>\n<ol>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"recomendacoes\" role=\"link\" tabindex=\"0\">Como</a> deve funcionar o sistema?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"Quais\" role=\"link\" tabindex=\"0\">Quais</a> softwares que deve usar.</li>\n</ol>",
			},
			'recomendacoes': {
				'text': "<p>Abrindo as mãos como quem apresenta a empresa, Carlos diz:</p>\n<ul>\n<li><p>Você deve se lembrar que essa empresa é antiga e tradicional.</p>\n</li>\n<li><p>Tanto os donos e os funcionários, quanto muitos dos clientes, têm pouco hábito de usar computadores. O sistema deve ser muito simples de ser usado. Não pode ser confuso ou ter muitas opçoes para os clientes. Basicamente é só fazer e acompanhar pedido para eles. E talvez melhorar o pagamento.</p>\n</li>\n<li><p>Tudo deve ser feito também para Web, porém em sites responsivos que funcionem em celulares. Por incrível que pareça, os mais velhos adotaram mais o celular que computadores. Não queremos nenhuma necessidade de instalar ou baixar algum software para o computador, ou celular, das pessoas.</p>\n</li>\n</ul>\n<p>Você ainda pode querer saber:</p>\n<ol>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"onde\" role=\"link\" tabindex=\"0\">Onde</a> ele vai executar?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"Quais\" role=\"link\" tabindex=\"0\">Quais</a> softwares que deve usar.</li>\n</ol>",
			},
			'Quais': {
				'text': "<p>{if humor=2: \nCom uma voz simpática e sorrindo, Carlos diz:</p>\n<ul>\n<li>Você pode escolher a linguagem de programação que for melhor para sua equipe}\n{if humor=1: \nCom uma voz simpática, Carlos diz:</li>\n<li>Você pode escolher a linguagem de programação que for melhor para sua equipe, mas nada de PHP, por favor}\n{if humor=0: \nMeio sem emoção, Carlos diz:</li>\n<li>Antes de escolher uma linguagem de programação, eu devo aprovar}\n{if humor=-1: \nCom uma voz dura, Carlos diz:</li>\n<li>Você deve fazer tudo em PHP!}\n{if humor=-2: \nCom uma voz antipática, Carlos diz:</li>\n<li>É essencial que o sistema seja todo em Perl.}</li>\n</ul>\n<ul>\n<li>Já instalamos um sistema gerenciador de banco de dados, o MySQL, por causa do sistema de ERP que instalamos. O sistema tem que usar esse SGDB também, mesmo que seja na rede, pois não quero gerenciar dois sistemas. Esse é obrigatório mesmo.</li>\n</ul>\n<p>Você pensa um pouco e pergunta se acha necessário <a class=\"squiffy-link link-passage\" data-passage=\"pagamento on-line\" role=\"link\" tabindex=\"0\">pagamento on-line</a>?</p>",
			},
			'pagamento on-line': {
				'text': "<p>Carlos pensa um pouco, não parece ser uma pergunta fácil. </p>\n<ul>\n<li>Não sei muito bem a tecnologia envolvida, mas sei que o ERP que compramos é compatível com esse serviço. Certamente nossos clientes iam gostar de pagar com cartão de crédito ou débito. Mas não sei se seria bom para a empresa, devido as taxas. Mas a forma de pagar de hoje é realmente complicada.</li>\n</ul>\n<p>Você ainda pode querer saber:</p>\n<ol>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"recomendacoes\" role=\"link\" tabindex=\"0\">Como</a> deve funcionar o sistema?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"onde\" role=\"link\" tabindex=\"0\">Onde</a> ele vai executar?</li>\n</ol>",
			},
			'@last': {
				'text': "<hr>\n\n<p>Você acha que já sabe tudo que precisa e se despede de Carlos:</p>\n<p>Quando você se despede ele\n{if humor=2: deseja muito boa sorte e diz que está a disposição}\n{if humor=1: dá um aperto de mãos e diz que qualquer coisa é marcar com a Débora}\n{if humor=0: te dá um adeus e volta a trabalhar. }\n{if humor=-1: vira para o lado e vai trabalhar.}\n{if humor=-2: dá um resmungo e te deixa falando sozinho.}</p>\n<p>Melhor voltar para o <a class=\"squiffy-link link-section\" data-section=\"corredor\" role=\"link\" tabindex=\"0\">corredor</a>.</p>\n<hr>",
			},
		},
	},
	'sala da gerência': {
		'text': "<h1 id=\"sala-da-ger-ncia\">Sala da Gerência</h1>\n<p>Nessa sala você ve duas mesas. Lá estão um homem e um mulher, com certeza são <strong>Armando Américo</strong> e <strong>Bruna Berílio</strong>. Bruna já é uma senhora de certa idade, como o dono da empresa, mas Armando Américo é jovem e lembra o pai, bem mais magro e em forma.</p>\n<p>Eles olham para você com um olhar inquisitivo e você se apresenta.</p>\n<p>Armando fica muito animado com sua presença, já Bruna parece ressabiada, mas ambos o cumprimentam com simpatia. Armando usa uma roupa social e Bruna está também razoavelmente arrumada, mas nem ele está de terno nem ela com roupa equivalente. </p>\n<p>Nas mesa de Armando há um notebook de última geração, ligado em uma planilha eletrônica, na mesa de Bruna, um computador de mesa, já bastante usado, desligado, muito papel e alguns cadernos que, quando abertos, mostram uma grande organização.</p>\n<p>Depois de conversar algumas amenidades, fica claro que você pode fazer perguntas para eles, e você já tem ideia de como começar:</p>\n<ul>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"antigas\" role=\"link\" tabindex=\"0\">Como</a> são feitas as coisas aqui?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"sistemas\" role=\"link\" tabindex=\"0\">Quais</a> outros sistemas vocês estão fazendo?</li>\n</ul>",
		'attributes': ["salas+=1"],
		'passageCount': 6,
		'passages': {
			'@last': {
				'text': "<p>A conversa está interessante, você deve <a class=\"squiffy-link link-section\" data-section=\"gerencia 2\" role=\"link\" tabindex=\"0\">continuar</a>. Um bom analista sempre percebe que pode obter mais informações. </p>",
			},
			'antigas': {
				'text': "<p>Bruna diz:</p>\n<ul>\n<li>Fazemos as coisas do mesmo jeito aqui há muitos anos, mas com a carga de trabalho aumentando, concordo que um sistema de vendas pode ajudar, mas não acho que precisamos mudar tanto.</li>\n</ul>\n<p>E Armando comenta:</p>\n<ul>\n<li>A livraria funciona da mesma forma há muitos anos, com tudo feito de forma manual. Porém, com a possibilidade cada vez maior de trabalhar com livros do mundo todo, nosso trabalho aumentou muito. Meu pai é “das antigas”, mas eu o convenci a começar a mudar as coisas, para eu poder tocar melhor o negócio com a Bruna quando papai se aposentar. </li>\n</ul>\n<p>Bruna parece ter problemas com essa opinião:</p>\n<ul>\n<li>Melhor não mexer muito, estamos crescendo e em time que está ganhando não se mexe. É só resovler uns probleminhas aqui e ali.</li>\n</ul>\n<p>Armando chama a atenção para si:</p>\n<ul>\n<li>O importante é que o sistema atenda bem a vontade do cliente: encomendar um livro raro, que não é encontrado com facilidade, e que cabe a gente procurar e dar um preço. </li>\n</ul>\n<p>Você pode perguntar:</p>\n<ul>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"sistemas\" role=\"link\" tabindex=\"0\">Quais</a> outros sistemas vocês estão fazendo?</li>\n</ul>",
			},
			'sistemas': {
				'text': "<p>Bruna olha para umas anotações que parece ter feito antes e fala:</p>\n<ul>\n<li>O importante é que se leve em conta que estamos comprando outros sistemas de informação não específicos para a Livraria ABC no mercado. Por exemplo, já temos um sistema de contas a pagar e a receber sendo implantado que deverá receber as informações do sistema que vocês vão fazer. Isso é realmente melhor que meus cadernos, pois não preciso fazer mais as contas.</li>\n</ul>\n<p>Ela olha para <a class=\"squiffy-link link-passage\" data-passage=\"necessidades\" role=\"link\" tabindex=\"0\">Armando</a>.</p>",
			},
			'necessidades': {
				'text': "<p>Armando pensa e diz:</p>\n<ul>\n<li>O que eu mais preciso é melhorar o nosso relacionamento com o cliente. Para isso, a informação que vem do sistema de vendas é essencial. Uma coisa importante, por exemplo, é saber que clientes freqüentes não compram mais na freqüência que compravam. Sabendo isso eu posso recuperar um cliente que deixou de nos procurar.</li>\n</ul>\n<p>Você pergunta se eles tem <a class=\"squiffy-link link-passage\" data-passage=\"oportunidade 1\" role=\"link\" tabindex=\"0\">alguma idéia</a>,</p>",
			},
			'oportunidade 1': {
				'text': "<p>Bruna diz:</p>\n<ul>\n<li>Outro é classificar os clientes de acordo com o tipo de livro que gostam, para podermos fazer ofertas de livros que encontramos, oportunidades que vemos no mercado. No fundo, conhecer os principais clientes é nosso principal segredo. </li>\n</ul>\n<p>Logo depois, Armando parece querer falar. Você pergunta <a class=\"squiffy-link link-passage\" data-passage=\"internet\" role=\"link\" tabindex=\"0\">o que ele pensa</a>?</p>",
			},
			'internet': {
				'text': "<p>Armando pensa um pouco e fala:</p>\n<ul>\n<li>Tenho pensado muito em como um sistema pode nos ajudar. Até mesmo pensei se não seria interessante vender livros pela Internet, com um site para os clientes fazerem encomendas, o que vocês acham disso? Seria uma grande novidade para nós e nossos clientes. Acho que comentei com meu pai, mas ele nunca presta atenção em tecnologia. </li>\n</ul>\n<p>Bruna diz:</p>\n<ul>\n<li>Hum... não sei se gostei da ideia de vender pela Internet. Mas um site chamando atenção para nosso negócio, com indicativos de como nos contactar, seria ótimo. </li>\n</ul>\n<p>Você anota a sugestão, fingindo não saber a opinião do Sr. Arnaldo, e pergunta se há algum <a class=\"squiffy-link link-passage\" data-passage=\"problema\" role=\"link\" tabindex=\"0\">problema</a> que deva estar ciente.</p>",
			},
			'problema': {
				'text': "<p>Bruna respira, pensa e se lembra de algo:</p>\n<ul>\n<li>Outra coisa importante é que, com os problemas de entrega, acabamos com um pequeno estoque de livros que compramos, mas os clientes não compraram da gente. Então eu quero fazer algo com isso. Uma mala direta de promoção, por exemplo. Acho que nossos clientes iam gostar de receber pequenos catálogos com livros de qualidade.</li>\n</ul>\n<p>Armando faz um pequeno sinal para você, parece que ele não concorda muito:</p>\n<ul>\n<li>Para isso que serve um site de vendas Bruna! Catálogos só dão trabalho de fazer, imprimir e enviar.</li>\n</ul>\n<p>Bruna, contrariada, lembra:</p>\n<ul>\n<li>Enviar a gente pode fazer por email. Nosso diferencial, que é o contato com os clientes, será perdido com um site de vendas.</li>\n</ul>\n<p>Você pode perguntar:</p>\n<ul>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"antigas\" role=\"link\" tabindex=\"0\">Como</a> são feitas as coisas aqui?</li>\n</ul>",
			},
		},
	},
	'gerencia 2': {
		'text': "<p>Você pensa um pouco e vê que tem mais perguntas:</p>\n<ul>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"pessoas\" role=\"link\" tabindex=\"0\">Quantas</a> pessoas trabalham aqui?</li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"gerencia\" role=\"link\" tabindex=\"0\">Quais</a> informações  gerenciais vocês precisam?</li>\n</ul>",
		'passageCount': 4,
		'passages': {
			'pessoas': {
				'text': "<p>Bruna diz:</p>\n<ul>\n<li>Hoje somos 7. Todo mundo tem seu cargo, mas todo mundo ajuda todo mundo. A Débora Dina e recepcionista e secretária, o Carlos faz tudo de TI sozinho, os vendedores falam com clientes e fornecedores, e nós também vendemos, fazemos tudo. Papai já está velho, mas tem cliente importantes que compram livros raros caríssimos e também trabalha muito.</li>\n</ul>\n<p>Armando também parece querer falar algo e você pede que ele <a class=\"squiffy-link link-passage\" data-passage=\"mais pessoas\" role=\"link\" tabindex=\"0\">participe</a>.</p>",
			},
			'mais pessoas': {
				'text': "<p>Armando diz:</p>\n<ul>\n<li>Primeiro pensei em contratar mais pessoas, porém isso não ia diminuir a confusão de papéis com que estamos lidando e a falta de informações, então resolvi que seria necessário informatizar a empresa para, se necessário, crescer. </li>\n</ul>\n<p>Bruna olha preocupada.</p>\n<ul>\n<li>Cada contratação é uma dificuldade. Todas pessoas aqui falam várias línguas e sabem muito de literatura. O Felipe tem um mestrado.</li>\n</ul>\n<p>Você pode perguntar:</p>\n<ul>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"gerencia\" role=\"link\" tabindex=\"0\">Quais</a> informações  gerenciais vocês precisam?</li>\n</ul>",
			},
			'gerencia': {
				'text': "<p>Armando diz:</p>\n<ul>\n<li>A partir dessa operação, também são necessários alguns dados para ajudar a gerenciar melhor a empresa. Dois relatórios são muito importantes para nós: um relatório de vendas em um período e um relatório de gastos por fornecedor. Hoje fazemos tudo na mão. Eu faço ele no Excel, mas tenho que digitar tudo de novo. O de fornecedores a mesma coisa. E preciso dos dois para entender o fechamento do mês.</li>\n</ul>\n<p>Armando tosse e fala:</p>\n<ul>\n<li>Outro relatório que nos ajudaria muito é o de pedidos não atendidos. Hoje a Bruna cuida disso, mas precisamos ficar de olho nos livros desejados que não estão no mercado. E também temos que saber todos os livros que já vendemos para cada pessoa, para poder fazer uma oferta se alguém quiser comprar aquele livro.</li>\n</ul>\n<p>Bruna <a class=\"squiffy-link link-passage\" data-passage=\"interrompe\" role=\"link\" tabindex=\"0\">interrompe</a>.</p>",
			},
			'interrompe': {
				'text': "<ul>\n<li>A gente precisa ter uma agenda de entregas, Tudo que tem que ser entregue e um status dizendo se já foi pedido, já foi recebido, já foi enviado e se já foi pago. Eu faço isso com cadernos, mas são muitos livros agora, acabo tendo que virar de página o tempo todo. É a única forma de saber que estamos trabalhando direito. O resto é mais financeiro.</li>\n</ul>\n<p>Você pode perguntar:</p>\n<ul>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"pessoas\" role=\"link\" tabindex=\"0\">Quantas</a> pessoas trabalham aqui?</li>\n</ul>",
			},
			'@last': {
				'text': "<hr>\n\n<p>Bruna diz: nossa, nós falamos muito.</p>\n<p>Com o que Armando concorda. Mas ele ainda diz: você precisa ir falar com os vendedores, eles sabem muito do que acontece na empresa e podem ter outras demandas.</p>\n<p>{if seen sala dos vendedores: Você diz que já falou com eles e que foi muito importante}</p>\n<p>Você se despede, e vai para o <a class=\"squiffy-link link-section\" data-section=\"corredor\" role=\"link\" tabindex=\"0\">corredor</a>.</p>\n<hr>",
			},
		},
	},
	'sala dos vendedores': {
		'text': "<h1 id=\"sala-dos-vendedores\">Sala dos vendedores</h1>\n<p>Você encontra um casal trabalhando no telefone. Certamente são Felipe Franciscano e Gabriela Gambra.</p>\n<p>Ambos estão parecendo bastante ocupados. Felipe está de terno, como o patrão. Gabriela também usa uma roupa um pouco mais formal. </p>\n<p>Você espera na porta <a class=\"squiffy-link link-section\" data-section=\"pacientemente\" role=\"link\" tabindex=\"0\">pacientemente</a> ou tenta <a class=\"squiffy-link link-passage\" data-passage=\"interromper\" role=\"link\" tabindex=\"0\">interromper</a>?</p>",
		'attributes': ["salas+=1"],
		'passages': {
			'interromper': {
				'text': "<p>Felipe levanta a mão com um sinal de pare. Claramente ele quer que você <a class=\"squiffy-link link-section\" data-section=\"pacientemente\" role=\"link\" tabindex=\"0\">espere</a>. Já Gabriela simplesmente vira de costas para você.</p>\n<p>Você imagina que isso pode demorar.</p>",
			},
		},
	},
	'pacientemente': {
		'text': "<h1 id=\"conversando-com-os-vendedores\">Conversando com os vendedores</h1>\n<p>Depois de algum tempo os dois telefonemas acabam praticamente juntos. Parece até que estavam falando um com o outro, mas claramente não foi isso. </p>\n<p>Felipe diz, {if seen interromper: parecendo irritado com você}{else: com um ar simpático}: </p>\n<ul>\n<li>Olá o que deseja?</li>\n</ul>\n<p>Você se apresenta e se explica, diz que está procurando informações para fazer um sistema que vai ajudá-los, pede desculpas por atrapalhar o serviço, mas que <a class=\"squiffy-link link-section\" data-section=\"entrevista vendedores\" role=\"link\" tabindex=\"0\">precisa da opinião deles</a>.</p>",
		'passages': {
		},
	},
	'entrevista vendedores': {
		'text': "<h1 id=\"entrevistando-os-vendedores\">Entrevistando os Vendedores</h1>\n<p>Eles ficam muito satisfeitos e começam a falar ao mesmo tempo. Parece que estão ansiosos por alguma ajuda. </p>\n<p>Você sente que é melhor fazer com que só um fale:</p>\n<ul>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"erros\" role=\"link\" tabindex=\"0\">Quais</a> os seus problemas mais comuns? - pergunta para Felipe </li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"arquivos\" role=\"link\" tabindex=\"0\">Quais</a> as informações que vocês tem? - pergunta para Gabriela </li>\n</ul>",
		'passageCount': 4,
		'passages': {
			'erros': {
				'text': "<p>Felipe fala {if seen interromper:, talvez um pouco irritado}{else: animado}:</p>\n<ul>\n<li>Hoje nosso processo, como é todo manual, tem muitos defeitos. Temos muita informação repetida, pois temos que controlar os pedidos dos clientes e as requisições aos fornecedores, que se cruzam. Muitas vezes recebemos um livro e por um problema de anotação não sabemos para qual cliente se destina. Então gastamos um bom tempo procurando, cliente por cliente, ficha por ficha, quem pediu aquele livro. </li>\n</ul>\n<p>Ele parece querer falar <a class=\"squiffy-link link-passage\" data-passage=\"demanda\" role=\"link\" tabindex=\"0\">mais</a>{if not seen arquivos:, mas você pode perguntar &quot;<a class=\"squiffy-link link-passage\" data-passage=\"arquivos\" role=\"link\" tabindex=\"0\">quais</a> as informações que vocês tem&quot; para Gabriela }{else: {if not seen reclamacoes:, mas você pode escutar <a class=\"squiffy-link link-passage\" data-passage=\"reclamacoes\" role=\"link\" tabindex=\"0\">Gabriela</a>}}.</p>",
			},
			'demanda': {
				'text': "<p>Felipe aproveita para continuar:</p>\n<ul>\n<li>Claramente, a primeira coisa que qualquer sistema deve fazer é suportar o nosso funcionamento diário. Estou falando da operação básica de atendimento aos clientes, não da contabilidade ou outras coisas do gênero, pois para essas vou comprar sistemas prontos .</li>\n</ul>\n<p>Felipe parece ter acabado{if not seen arquivos:, você pergunta &quot;<a class=\"squiffy-link link-passage\" data-passage=\"arquivos\" role=\"link\" tabindex=\"0\">quais</a> as informações existentes&quot; para Gabriela}{else: {if not seen reclamacoes:, você se vira para <a class=\"squiffy-link link-passage\" data-passage=\"reclamacoes\" role=\"link\" tabindex=\"0\">Gabriela</a>}}.</p>",
			},
			'arquivos': {
				'text': "<p>Gabriela também tem informações {if seen interromper:, ela parece indecisa sobre você, porém fala}{else: e as fornece prontamente}:</p>\n<ul>\n<li>Mantemos também vários arquivos de clientes, o que facilita em certos casos, mas dificulta em outros. Temos os clientes com pedido em andamento, aqueles com pedidos atendidos, mas não pagos, os freqüentes e os outros clientes, que não se enquadram em nenhuma dessas categorias. E tem a lista dos clientes “expulsos”, pois nos deram calote e ainda tem a cara de pau de pedir outro livro. Eu preciso ter isso em uma tela de um sistema, não nos meus cadernos, ou na planilha do Felipe.</li>\n</ul>\n<p>Gabriela aponta para o notebook, com certo desgosto, ou seria inveja?</p>\n<p>Ela parece querer falar <a class=\"squiffy-link link-passage\" data-passage=\"reclamacoes\" role=\"link\" tabindex=\"0\">mais</a>{if not seen erros:, mas você pode perguntar &quot;<a class=\"squiffy-link link-passage\" data-passage=\"erros\" role=\"link\" tabindex=\"0\">Quais</a> os seus problemas mais comuns&quot; para Felipe}{else: {if not seen demanda:, mas você pode escutar <a class=\"squiffy-link link-passage\" data-passage=\"demanda\" role=\"link\" tabindex=\"0\">Felipe</a>}}.</p>",
			},
			'reclamacoes': {
				'text': "<p>Gabriela continua:</p>\n<ul>\n<li>Como estamos sempre manipulando muitas fichas, algumas vezes esquecemos de requisitar a um fornecedor um ou mais livros pedidos pelo cliente. Isso atrasa o atendimento e resulta em reclamações que não são boas para a livraria.</li>\n</ul>\n<p>Gabriela parece ter acabado{if not seen erros:, mas você pode perguntar &quot;<a class=\"squiffy-link link-passage\" data-passage=\"erros\" role=\"link\" tabindex=\"0\">Quais</a> os seus problemas mais comuns&quot; para Felipe}{else: {if not seen demanda:, mas você pode escutar <a class=\"squiffy-link link-passage\" data-passage=\"demanda\" role=\"link\" tabindex=\"0\">Felipe</a>}}.</p>",
			},
			'@last': {
				'text': "<p>Quando eles dão uma respirada e param de falar, você pergunta então <a class=\"squiffy-link link-section\" data-section=\"como funciona o trabalho\" role=\"link\" tabindex=\"0\">como funciona o trabalho</a> deles.</p>",
			},
		},
	},
	'como funciona o trabalho': {
		'text': "<p>{if seen interromper:Eles parecem ter esquecido a forma rude como os interrompeu, e ficam animados com seu interesse}{else: Seu interesse os deixa mais animados}:</p>\n<p>Gabriela diz que existe um passo a passo muito bem definido. Mas que Felipe pode começar a explicar.</p>\n<p>Felipe diz:</p>\n<ul>\n<li>Somos nós que fazemos as vendas mesmo aqui, mas às vezes precisamos de ajuda. Normalmente eu recebo um pedido do cliente com uma lista de livros, ou um livro só. </li>\n</ul>\n<p>Com certo orgulho, ele diz:</p>\n<ul>\n<li>Então eu vou nos vários catálogos que possuímos, alguns de editoras, outros de distribuidoras, e procuro os livros desejados. Também procuro na internet, em lojas e leilões. E sebos. Vale tudo. Tenho até alguns contatos em cidades com grandes livreiros, como Nova York, Paris e Londres. Tudo está aqui nessa sala.</li>\n</ul>\n<p>Gabriela parece confessar um segredo:</p>\n<ul>\n<li>Muitos de nossos contatos são bem antigos, eles foram criados pelo Sr. Arnaldo e a D. Bruna no início do negócio. Livreiros quase formam uma sociedade secreta.</li>\n</ul>\n<p>Felipe <a class=\"squiffy-link link-passage\" data-passage=\"respira\" role=\"link\" tabindex=\"0\">respira</a>, como espantado,  e Gabriela olha como quem diz: contei!</p>",
		'passageCount': 4,
		'passages': {
			'respira': {
				'text': "<p>Felipe continua:</p>\n<ul>\n<li>Faço uma lista com cada livro, onde podemos comprá-los, o prazo de entrega, e o preço de custo de cada oferta de cada livro e uma estimativa de preço de frete.  Algumas vezes tenho que esperar uma cotação que vai chegar for e-mail ou telefone, então eu paro o serviço para começar mais tarde.</li>\n</ul>\n<p>Ele pausa um pouco:</p>\n<ul>\n<li>Essa lista eu envio para a Bruna, que define o preço de venda de cada livro. Ela faz isso baseada na experiência dela com os clientes e as necessidades da empresa.  Nós compramos os livros em muitas moedas, são livros caros, de arte, ou livros raros e antigos, de colecionador, e a taxa de câmbio também é importante.</li>\n</ul>\n<p>Felipe para, fica pensando e Gabriela <a class=\"squiffy-link link-passage\" data-passage=\"passa a falar\" role=\"link\" tabindex=\"0\">passa a falar</a>:</p>",
			},
			'passa a falar': {
				'text': "<ul>\n<li>Com os preços definidos eu faço uma estimativa do frete para o cliente e preparo uma proposta. Essa proposta é passada para o cliente por uma de várias formas: telefone, e-mail ou, ultimamente, Whatsapp. </li>\n</ul>\n<p>Ela pega um fax em sua mesa:</p>\n<ul>\n<li>Geralmente dentro de 24h o cliente confirma a proposta, ou parte dela. Eu então separo os pedidos que serão feitos na sexta-feira. Esse fax é um aceite, o cliente deve ter uns 90 anos. Grande colecionador.</li>\n</ul>\n<p>Felipe diz, explicando um pouco mais:</p>\n<ul>\n<li>Quem trata dessa parte dos pedidos para os fornecedores é o próprio Sr. Américo ou seu filho. Muitas vezes ele consegue mais um desconto na compra dos livros. Algumas das vezes esse desconto, ou parte dele, é repassado para o cliente.</li>\n</ul>\n<p>Gabriela pega um copo de água em sua mesa e <a class=\"squiffy-link link-passage\" data-passage=\"bebeu\" role=\"link\" tabindex=\"0\">bebe</a> um pouco, pegando fôlego.</p>",
			},
			'bebeu': {
				'text': "<p>Gabriela continua:</p>\n<ul>\n<li><p>Quando chegam todos os livros de um cliente eu começo a trabalhar de novo. </p>\n</li>\n<li><p>Sou eu quem “fecha” a venda. Recalculo o preço de custo e de venda. Passo os casos de possível desconto para a Bruna, que decide na hora. Emito uma fatura, uma nota fiscal, se necessário um boleto, empacoto e preparo para os entregadores (a gente usa a DHL ou a Fedex). Muitas vezes eu telefono, ou mando um e-mail, para avisar o cliente que o pedido está sendo enviado. </p>\n</li>\n</ul>\n<p>Você pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"pagam\" role=\"link\" tabindex=\"0\">Como</a> os clientes pagam?</li>\n</ul>",
			},
			'pagam': {
				'text': "<p>Gabriela não parece gostar desse assunto:</p>\n<ul>\n<li>Hoje pelo boleto no Brasil, por depósito internacional. É muito ruim, porque demora uns 3 dias para sabermos que foi pago, e o cliente às vezes esquece de pagar e pede uma segunda via, ou ainda temos que lembrá-los disso, o que é sempre desagradável. </li>\n</ul>\n<p>Felipe diz:</p>\n<ul>\n<li>A gente também pensou em usar cartão de crédito ou débito, mas não gostamos das taxas. Teríamos que somá-la ao nosso preço e os clientes também não vão gostar. </li>\n</ul>\n<p>Gabriela revira os olhos, como se essa discussão fosse antiga:</p>\n<ul>\n<li>Os clientes nem iam saber, a gente podia cobrar a taxa de todo mundo e não ia fazer diferença, mas claramente o Sr. Arnaldo não quer fazer isso. Além disso, também temos taxas de envio de dinheiro, só que o cliente paga do lado de lá.</li>\n</ul>\n<p>Felipe diz:</p>\n<ul>\n<li>Nós temos que fazer o cliente pagar antes de nós pagarmos o fornecedor. Em todo caso, hoje a gente só envia o livro após o cliente pagar.</li>\n</ul>",
			},
			'@last': {
				'text': "<hr>\n\n<p>Você está cheio de informações e agora só pensa em registrar tudo.</p>\n<p>Precisa se despedir, o que você faz com muita educação. </p>\n<p>Volte ao <a class=\"squiffy-link link-section\" data-section=\"corredor\" role=\"link\" tabindex=\"0\">corredor</a>.</p>\n<hr>",
			},
		},
	},
	'saida': {
		'text': "<h1 id=\"saindo-do-recep-o-para-a-rua\">Saindo do Recepção para a rua</h1>\n<p>Você se despede também da Débora e vai embora.</p>\n<p>Missão cumprida, agora é fazer uma proposta.</p>\n<p>Você pode ver os <a class=\"squiffy-link link-section\" data-section=\"Créditos\" role=\"link\" tabindex=\"0\">Créditos</a> ou voltar para o <a class=\"squiffy-link link-section\" data-section=\"Início\" role=\"link\" tabindex=\"0\">Início</a>.</p>",
		'passages': {
		},
	},
}
})();