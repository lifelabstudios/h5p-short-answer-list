var H5P = H5P || {};

/**
 * Short Anwer List module
 * @external {jQuery} $ H5P.jQuery
 */
H5P.ShortAnswerList = (function ($, EventDispatcher, JoubelUI) {
  "use strict";

  // CSS Classes:
  var MAIN_CONTAINER = "h5p-short-answer-list";

  /**
   * Initialize module.
   * @param {Object} params Behavior settings
   * @param {Number} id Content identification
   * @returns {Object} ShortAnswerList ShortAnswerList instance
   */
  function ShortAnswerList(params, id, extras) {
    H5P.EventDispatcher.call(this);

    this.$ = $(this);
    this.id = id;
    this.extras = extras;

    // Set default behavior.
    this.params = $.extend(
      {
        title: this.getTitle(),
        elementList: [],
        helpTextLabel: "Read more",
        helpText: "Help text",
      },
      params
    );

    /**
     * Implements resume (save content state)
     *
     * @method getCurrentState
     * @public
     * @returns [array] array containing input fields state
     */
    this.getCurrentState = function () {
      var inputs = this.getInputArray(this.pageInstances),
        state = [];

      inputs.forEach(function (input, index) {
        state[index] = input.value || "";
      });

      return state;
    };
  }

  // Setting up inheritance
  ShortAnswerList.prototype = Object.create(EventDispatcher.prototype);
  ShortAnswerList.prototype.constructor = ShortAnswerList;

  /**
   * Attach function called by H5P framework to insert H5P content into page.
   *
   * @param {jQuery} $container The container which will be appended to.
   */
  ShortAnswerList.prototype.attach = function ($container) {
    var self = this;

    this.$inner = $("<div>", {
      class: MAIN_CONTAINER,
    }).appendTo($container);

    var ShortAnswerListTemplate =
      '<div class="page-header" role="heading" tabindex="-1">' +
      ' <div class="page-title">{{{title}}}</div>' +
      ' <button class="page-help-text">{{{helpTextLabel}}}</button>' +
      "</div>";

    /*global Mustache */
    self.$inner.append(Mustache.render(ShortAnswerListTemplate, self.params));

    self.$pageTitle = self.$inner.find(".page-header");
    self.$helpButton = self.$inner.find(".page-help-text");

    self.createHelpTextButton();

    this.pageInstances = [];

    this.params.elementList.forEach(function (element) {
      var $elementContainer = $("<div>", {
        class: "h5p-short-answer-list-element",
      }).appendTo(self.$inner);

      var elementInstance = H5P.newRunnable(element, self.id);

      elementInstance.on("loaded", function () {
        self.trigger("resize");
      });

      elementInstance.attach($elementContainer);

      self.pageInstances.push(elementInstance);
    });

    self.createSubmissionButton();

    if (this.extras && this.extras.previousState !== "undefined") {
      self.setPreviousState(this.extras.previousState);
    }
  };

  /**
   * Create help text functionality for reading more about the task
   */
  ShortAnswerList.prototype.createHelpTextButton = function () {
    var self = this;

    if (this.params.helpText !== undefined && this.params.helpText.length) {
      self.$helpButton.on("click", function () {
        self.trigger("open-help-dialog", {
          title: self.params.title,
          helpText: self.params.helpText,
        });
      });
    } else {
      self.$helpButton.remove();
    }
  };

  ShortAnswerList.prototype.createSubmissionButton = function () {
    var self = this;
    var $saveButton = $("<div>", {
      class: "h5p-joubelui-button h5p-short-answer-list-save-button",
      text: "Submit",
    }).appendTo(self.$inner);

    var $savedText = $("<div>", {
      class: "h5p-short-answer-list-saved-message",
      text: "Successfully saved progress!",
    })
      .appendTo(self.$inner)
      .hide();

    $saveButton.on("click", function () {
      self.triggerAnsweredEvents();
      const score = self.getScore();
      const maxScore = self.pageInstances.length;
      const success = score >= self.params.completionCriteria;
      success ? self.triggerXAPIScored(score, maxScore, "completed", true, success) : self.triggerXAPIScored(score, maxScore, "experienced", false, !success);
      $savedText.show();
      $savedText.fadeOut(3000);
    });
  };

  ShortAnswerList.prototype.getScore = function () {
    let score = 0;
    this.pageInstances.forEach(function (elementInstance) {
      if (elementInstance.getScore) {
        score += elementInstance.getScore();
      }
    });

    return score;
  };

  /**
   * Retrieves input array.
   */
  ShortAnswerList.prototype.getInputArray = function () {
    var inputArray = [];
    this.pageInstances.forEach(function (elementInstance) {
      if (elementInstance.libraryInfo.machineName === "H5P.TextInputField") {
        inputArray.push(elementInstance.getInput());
      }
    });

    return inputArray;
  };

  /**
   * Returns True if all required inputs are filled.
   * @returns {boolean} True if all required inputs are filled.
   */
  ShortAnswerList.prototype.requiredInputsIsFilled = function () {
    var requiredInputsIsFilled = true;
    this.pageInstances.forEach(function (elementInstance) {
      if (elementInstance.libraryInfo.machineName === "H5P.TextInputField") {
        if (!elementInstance.isRequiredInputFilled()) {
          requiredInputsIsFilled = false;
        }
      }
    });

    return requiredInputsIsFilled;
  };

  /**
   * Mark required input fields.
   */
  ShortAnswerList.prototype.markRequiredInputFields = function () {
    this.pageInstances.forEach(function (elementInstance) {
      if (elementInstance.libraryInfo.machineName === "H5P.TextInputField") {
        if (!elementInstance.isRequiredInputFilled()) {
          elementInstance.markEmptyField();
        }
      }
    });
  };

  /**
   * Sets previous state values for input fields
   * @param state
   */
  ShortAnswerList.prototype.setPreviousState = function (state) {
    var inputIndex = 0;

    this.pageInstances.forEach(function (instance) {
      if (
        instance.libraryInfo.machineName === "H5P.TextInputField" &&
        instance.$inputField !== undefined
      ) {
        if (state && state[inputIndex] && !instance.$inputField.val()) {
          instance.$inputField.val(state[inputIndex]);
        }

        inputIndex++;
      }
    });
  };

  /**
   * Sets focus on page
   */
  ShortAnswerList.prototype.focus = function () {
    this.$pageTitle.focus();
  };

  /**
   * Get page title
   * @returns {String} page title
   */
  ShortAnswerList.prototype.getTitle = function () {
    return H5P.createTitle(
      this.extras && this.extras.metadata && this.extras.metadata.title
        ? this.extras.metadata.title
        : "Instructions"
    );
  };

  /**
   * Triggers an 'answered' xAPI event for all inputs
   */
  ShortAnswerList.prototype.triggerAnsweredEvents = function () {
    this.pageInstances.forEach(function (elementInstance) {
      if (elementInstance.triggerAnsweredEvent) {
        elementInstance.triggerAnsweredEvent();
      }
    });
  };

  /**
   * Helper function to return all xAPI data
   * @returns {Array}
   */
  ShortAnswerList.prototype.getXAPIDataFromChildren = function () {
    var children = [];

    this.pageInstances.forEach(function (elementInstance) {
      if (elementInstance.getXAPIData) {
        children.push(elementInstance.getXAPIData());
      }
    });

    return children;
  };

  /**
   * Generate xAPI object definition used in xAPI statements.
   * @return {Object}
   */
  ShortAnswerList.prototype.getxAPIDefinition = function () {
    var definition = {};
    var self = this;

    definition.interactionType = "compound";
    definition.type = "http://adlnet.gov/expapi/activities/cmi.interaction";
    definition.description = {
      "en-US": self.params.title,
    };
    definition.extensions = {
      "https://h5p.org/x-api/h5p-machine-name": "H5P.ShortAnswerList",
    };

    return definition;
  };

  /**
   * Add the question itself to the definition part of an xAPIEvent
   */
  ShortAnswerList.prototype.addQuestionToXAPI = function (xAPIEvent) {
    var definition = xAPIEvent.getVerifiedStatementValue([
      "object",
      "definition",
    ]);
    $.extend(definition, this.getxAPIDefinition());
  };

  /**
   * Get xAPI data.
   * Contract used by report rendering engine.
   *
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
   */
  ShortAnswerList.prototype.getXAPIData = function () {
    var xAPIEvent = this.createXAPIEventTemplate("compound");
    this.addQuestionToXAPI(xAPIEvent);
    return {
      statement: xAPIEvent.data.statement,
      children: this.getXAPIDataFromChildren(),
    };
  };

  return ShortAnswerList;
})(H5P.jQuery, H5P.EventDispatcher, H5P.JoubelUI);