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
  function ShortAnswerList(params, id, contentData) {
    H5P.EventDispatcher.call(this);

    this.$ = $(this);
    this.id = id;
    this.contentData = contentData;
    this.answersLocked = contentData?.previousState?.answersLocked || false;

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

    this.pageInstances = [];

    /**
     * Implements resume (save content state)
     *
     * @method getCurrentState
     * @public
     * @returns [array] array containing input fields state
     */
    this.getCurrentState = function () {
      const inputs = this.getInputArray();
      const answers = contentData?.previousState?.answers || [];

      for (let i = 0; i < inputs.length; i++) {
        answers[i] = inputs[i].value || "";
      }

      return {
        answers,
        answersLocked: this.answersLocked,
      };
    };
  }

  // Setting up inheritance
  ShortAnswerList.prototype = Object.create(H5P.EventDispatcher.prototype);
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

    if (!self.params.allowEditAfterSubmission) {
      const confirmationPopup = `<div class="confirmation-dialog">
      <div class="confirmation-dialog-content">
        <div class="confirmation-dialog-header"><h3 class="title">Are you sure you want to submit?</h3></div>
        <div class="confirmation-dialog-body"><p class="message">After clicking "Submit", you will NOT be able to change your answers.</p></div>
        <div class="confirmation-dialog-footer">
          <button class="confirmation-dialog-cancel-button h5p-joubelui-button h5p-button">Cancel</button>
          <button class="confirmation-dialog-submit-button h5p-joubelui-button h5p-button">Submit</button>
        </div>
      </div>
    </div>`;

      self.$inner.append(Mustache.render(confirmationPopup));
      self.$inner
        .find(".confirmation-dialog-cancel-button")
        .on("click", function () {
          self.$inner.find(".confirmation-dialog").removeClass("active");
        });
      self.$inner
        .find(".confirmation-dialog-submit-button")
        .on("click", function () {
          self.calculateAndSubmitScore();
          self.$inner.find(".confirmation-dialog").removeClass("active");
          self.lockAllResponses();
        });
    }

    var ShortAnswerListTemplate = `
        <div class="page-header" role="heading" tabindex="-1">
            <div class="page-title">{{{title}}}</div>
            <button class="page-help-text">{{{helpTextLabel}}}</button>
        </div>`;

    /*global Mustache */
    self.$inner.append(Mustache.render(ShortAnswerListTemplate, self.params));

    var requiredFieldWarning = `<p class="required-field-warning">
            <i>Any question marked with<span style="color: red"> * </span> indicates the question must be answered before submission.</i>
          </p>`;

    self.$requiredFieldWarning = $("<div>", {
      class: "required-field-warning-container",
    })
      .append(Mustache.render(requiredFieldWarning))
      .hide();

    self.$inner.append(self.$requiredFieldWarning);

    self.$pageTitle = self.$inner.find(".page-header");
    self.$helpButton = self.$inner.find(".page-help-text");

    self.createHelpTextButton();

    this.pageInstances = [];

    self.$footerContainer = $("<div>", {
      class: "h5p-short-answer-footer",
    });

    self.$submitButton = $("<button>", {
      class: "h5p-joubelui-button h5p-short-answer-list-submit-button",
      type: "submit",
      text: "Submit",
    });

    self.$savedText = $("<div>", {
      class: "h5p-short-answer-list-saved-message",
      text: "Successfully saved progress!",
    });

    this.params.elementList.forEach(function (element) {
      var $elementContainer = $("<div>", {
        class: "h5p-short-answer-list-element",
      }).appendTo(self.$inner);

      var elementInstance = H5P.newRunnable(element, self.id);

      elementInstance.on("loaded", function () {
        self.trigger("resize");
      });

      if (elementInstance.libraryInfo.machineName === "H5P.TextInputField") {
        elementInstance.on("textbox-changed", () => {
          if (self.requiredInputsIsFilled()) {
            self.$submitButton.prop("disabled", false);
            self.$submitButton.removeClass("disabled-finish-button");
          } else {
            self.$submitButton.prop("disabled", true);
            self.$submitButton.addClass("disabled-finish-button");
          }
        });
      }

      if (elementInstance.libraryInfo.machineName === "H5P.DropdownSelect") {
        elementInstance.on("select-box-changed", () => {
          if (self.requiredInputsIsFilled()) {
            self.$submitButton.prop("disabled", false);
            self.$submitButton.removeClass("disabled-finish-button");
          } else {
            self.$submitButton.prop("disabled", true);
            self.$submitButton.addClass("disabled-finish-button");
          }
        });
      }

      elementInstance.attach($elementContainer);

      self.pageInstances.push(elementInstance);
    });

    self.$footerContainer.appendTo(self.$inner);
    self.$submitButton.appendTo(self.$footerContainer);
    self.$savedText.appendTo(self.$footerContainer).hide();

    self.createSubmissionButton();

    if (self.hasRequiredFields()) {
      self.$requiredFieldWarning.show();
    }

    if (this.contentData?.previousState != null) {
      self.setPreviousState(this.contentData.previousState);
    }
  };

  /**
   * Create help text functionality for reading more about the task
   */
  ShortAnswerList.prototype.createHelpTextButton = function () {
    var self = this;

    if (this.params.helpText !== undefined && this.params.helpText.length) {
      self.$helpButton.on("click", function () {
        self.showHelpDialog();
      });
    } else {
      self.$helpButton.remove();
    }
  };

  ShortAnswerList.prototype.createSubmissionButton = function () {
    var self = this;

    if (self.hasRequiredFields()) {
      self.$submitButton.prop("disabled", true);
      self.$submitButton.addClass("disabled-finish-button");
    }

    if (self.params.allowEditAfterSubmission) {
      self.$submitButton.on("click", function () {
        self.calculateAndSubmitScore();
      });
    } else {
      self.$submitButton.on("click", function () {
        self.$inner
          .find(".confirmation-dialog")
          .addClass("confirmation-dialog active");
      });
    }
  };

  ShortAnswerList.prototype.calculateAndSubmitScore = function () {
    var self = this;
    self.triggerAnsweredEvents();
    const score = self.getScore();
    const maxScore = self.getMaxScore();
    self.triggerXAPIScored(score, maxScore, "completed", true, true);
    self.$savedText.show();
    self.$savedText.fadeOut(3000);
    self.trigger("free-response-completed");
  };

  ShortAnswerList.prototype.lockAllResponses = function () {
    var self = this;
    this.answersLocked = true;
    self.$inner.find(".h5p-text-input-field-textfield").each(function () {
      $(this).attr("readonly", "true");
      $(this).css({ "font-style": "italic" });
    });
    self.$inner.find(".h5p-dropdown-selector").each(function () {
      $(this).attr("disabled", "disabled");
      $(this).toggleClass("no-dropdown-arrow");
    });
    self.$submitButton.hide();
  };

  ShortAnswerList.prototype.hasRequiredFields = function () {
    for (const pageInstance of this.pageInstances) {
      if (
        pageInstance.libraryInfo.machineName === "H5P.TextInputField" ||
        pageInstance.libraryInfo.machineName === "H5P.DropdownSelect"
      ) {
        if (pageInstance.params.requiredField) {
          return true;
        }
      }
    }
    return false;
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

  ShortAnswerList.prototype.getMaxScore = function () {
    return (
      this.pageInstances.filter(
        (instance) => instance.libraryInfo.machineName === "H5P.TextInputField"
      ).length +
      this.pageInstances.filter(
        (instance) => instance.libraryInfo.machineName === "H5P.DropdownSelect"
      ).length
    );
  };

  ShortAnswerList.prototype.showHelpDialog = function () {
    var self = this;

    let helpTextDialog = new JoubelUI.createHelpTextDialog(
      self.params.helpTextLabel,
      self.params.helpText,
      "Close"
    );

    // Handle closing of the dialog
    helpTextDialog.on("closed", function () {
      // Set focus back on the page
      self.focus();
    });

    this.$inner.append(helpTextDialog.getElement());

    helpTextDialog.focus();
  };

  /**
   * Retrieves input array.
   */
  ShortAnswerList.prototype.getInputArray = function () {
    let inputArray = [];
    for (const elementInstance of this.pageInstances) {
      if (
        elementInstance.libraryInfo.machineName === "H5P.TextInputField" ||
        elementInstance.libraryInfo.machineName === "H5P.DropdownSelect"
      ) {
        inputArray.push(elementInstance.getInput());
      }
    }

    return inputArray;
  };

  /**
   * Returns True if all required inputs are filled.
   * @returns {boolean} True if all required inputs are filled.
   */
  ShortAnswerList.prototype.requiredInputsIsFilled = function () {
    let requiredInputsIsFilled = true;
    for (const elementInstance of this.pageInstances) {
      if (
        elementInstance.libraryInfo.machineName === "H5P.TextInputField" ||
        elementInstance.libraryInfo.machineName === "H5P.DropdownSelect"
      ) {
        if (!elementInstance.isRequiredInputFilled()) {
          requiredInputsIsFilled = false;
        }
      }
    }

    return requiredInputsIsFilled;
  };

  /**
   * Mark required input fields.
   */
  ShortAnswerList.prototype.markRequiredInputFields = function () {
    for (const elementInstance of this.pageInstances) {
      if (
        elementInstance.libraryInfo.machineName === "H5P.TextInputField" ||
        elementInstance.libraryInfo.machineName === "H5P.DropdownSelect"
      ) {
        if (!elementInstance.isRequiredInputFilled()) {
          elementInstance.markEmptyField();
        }
      }
    }
  };

  /**
   * Sets previous state values for input fields
   * @param state
   */
  ShortAnswerList.prototype.setPreviousState = function (state) {
    var self = this;
    let inputIndex = 0;

    for (const instance of this.pageInstances) {
      if (
        instance.libraryInfo.machineName === "H5P.TextInputField" &&
        instance.$inputField !== undefined
      ) {
        if (
          state &&
          state.answers?.[inputIndex] &&
          !instance.$inputField.val()
        ) {
          instance.$inputField.val(state.answers?.[inputIndex]);
        }

        inputIndex++;
      }
      if (
        instance.libraryInfo.machineName === "H5P.DropdownSelect" &&
        instance.$selector !== undefined
      ) {
        if (state && state.answers?.[inputIndex]) {
          instance.$selector.val(state.answers?.[inputIndex]);
        }
        inputIndex++;
      }
    }

    if (state?.answersLocked) {
      self.lockAllResponses();
    }

    if (state && self.requiredInputsIsFilled()) {
      self.$submitButton.prop("disabled", false);
      self.$submitButton.removeClass("disabled-finish-button");
    }
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
      this.contentData &&
        this.contentData.metadata &&
        this.contentData.metadata.title
        ? this.contentData.metadata.title
        : "Instructions"
    );
  };

  /**
   * Triggers an 'answered' xAPI event for all inputs
   */
  ShortAnswerList.prototype.triggerAnsweredEvents = function () {
    for (const elementInstance of this.pageInstances) {
      if (elementInstance.triggerAnsweredEvent) {
        elementInstance.triggerAnsweredEvent();
      }
    }
  };

  /**
   * Helper function to return all xAPI data
   * @returns {Array}
   */
  ShortAnswerList.prototype.getXAPIDataFromChildren = function () {
    let children = [];

    for (const elementInstance of this.pageInstances) {
      if (elementInstance.getXAPIData) {
        children.push(elementInstance.getXAPIData());
      }
    }

    return children;
  };

  /**
   * Generate xAPI object definition used in xAPI statements.
   * @return {Object}
   */
  ShortAnswerList.prototype.getxAPIDefinition = function () {
    let definition = {};
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
    let definition = xAPIEvent.getVerifiedStatementValue([
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
    let xAPIEvent = this.createXAPIEventTemplate("compound");
    this.addQuestionToXAPI(xAPIEvent);
    return {
      statement: xAPIEvent.data.statement,
      children: this.getXAPIDataFromChildren(),
    };
  };

  return ShortAnswerList;
})(H5P.jQuery, H5P.EventDispatcher, H5P.JoubelUI);
