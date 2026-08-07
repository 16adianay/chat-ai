$(function () {
  DevExpress.config({ 
    editorStylingMode: 'filled' // or 'outlined' | 'underlined'
  });

  DevExpress.localization.loadMessages({
    en: {
      "dxChat-textareaPlaceholder": "Enter a prompt...",
    },
  });

  let chatInstance;
  let popupInstance;
  let clearButtonInstance;
  let form;
  let gridInstance;

  function pushMessage(message) {
    chatInstance
      .getDataSource()
      .store()
      .push([
        {
          type: "insert",
          data: {
            id: Date.now() + Math.random(),
            timestamp: new Date(),
            ...message,
          },
        },
      ]);
  }

  function setDisabled(disabled) {
    chatInstance.option("disabled", disabled);
  }

  function updateClearButtonState() {
    const items = chatInstance.getDataSource().items();
    clearButtonInstance?.option("disabled", items.length === 0);
  }

  function clearChat() {
    const store = chatInstance.getDataSource().store();

    store.clear();
    chatInstance.getDataSource().reload();
    updateClearButtonState();
  }

  function handleUserMessage(message) {
    setDisabled(true);

    const finish = () => {
      setDisabled(false);
      updateClearButtonState();
    };

    const routed = routeMessage(message.text, {
      form,
      gridInstance,
      aiIntegration,
      pushMessage,
    });

    routed.finally(finish);
  }

  popupInstance = $("#aiAssistantContainer")
    .dxPopup({
      title: "AI Assistant",
      width: 400,
      height: "90%",
      dragEnabled: true,
      resizeEnabled: true,
      showCloseButton: true,
      shading: false,
      visible: false,
      onHiding() {
       $(".dx-fa-button").css("visibility", "visible");
      },
      onShowing() {
        $(".dx-fa-button").css("visibility", "hidden");
      },
      position: {
        my: "right top",
        at: "right top",
        of: ".demo-container",
        offset: "-20 20",
      },
      toolbarItems: [
        {
          widget: "dxButton",
          toolbar: "top",
          location: "after",
          cssClass: CLASSES.clearChatButton,
          options: {
            icon: "clearhistory",
            disabled: true,
            hint: "Clear chat",
            onClick: () => clearChat(),
            onInitialized: (e) => {
              clearButtonInstance = e.component;
            },
          },
        },
      ],
      contentTemplate($container) {
        const $chatContainer = $("<div>")
          .addClass("ai-chat-content")
          .appendTo($container);

        $chatContainer.dxChat({
          height: "100%",
          showAvatar: false,
          width: "auto",
          dataSource: {
            store: new DevExpress.data.ArrayStore({ key: "id" }),
          },
          reloadOnChange: true,
          user: { id: "user" },
          showUserName: false,
          speechToTextEnabled: true,
          suggestions: {
            items: [
              { text: "Show Completed Tasks", prompt: "Show Completed Tasks" },
              {
                text: "Change State to Texas",
                prompt: "Change State to Texas",
              },
            ],
            onItemClick(e) {
              const { prompt } = e.itemData;
              const message = {
                id: Date.now() + Math.random(),
                timestamp: new Date(),
                author: { id: "user" },
                text: prompt,
              };

              pushMessage(message);
              handleUserMessage(message);
            },
          },
          emptyViewTemplate(_data, container) {
            const $icon = $("<div>").addClass(
              "dx-chat-messagelist-empty-image dx-ai-chat__empty-image",
            );
            const $message = $("<div>")
              .addClass("ai-chat-empty-message")
              .text(emptyViewMessage);
            const $prompt = $("<div>")
              .addClass("ai-chat-empty-prompt")
              .text(emptyViewPrompt);

            $(container).append($icon).append($message).append($prompt);
          },
          onMessageEntered(e) {
            handleUserMessage(e.message);
          },
          onInitialized(e) {
            chatInstance = e.component;
          },
        });
      },
    })
    .dxPopup("instance");

  const aiIntegration = createAiIntegration();

  form = $("#form-container")
    .dxForm({
      formData: employee,
      colCount: 3,
      labelLocation: "top",
      aiIntegration,
      items: [
        {
          dataField: "Prefix",
          label: { text: "Title" },
          editorType: "dxSelectBox",
          editorOptions: { items: titles },
          aiOptions: {
            instruction:
              "Only fill this field with one of the allowed values (Mr., Mrs., Ms.) if a " +
              "title is explicitly mentioned in the text. Never use this field for any part " +
              "of a person's name.",
          },
        },
        { dataField: "FirstName", label: { text: "First Name" } },
        {
          dataField: "LastName",
          label: { text: "Last Name" },
          aiOptions: {
            instruction:
              "If the text gives a full person name (e.g. 'customer name', 'employee name') " +
              "without separately labeled first/last names, use only the first word as First " +
              "Name and the rest of the name as Last Name.",
          },
        },
        {
          dataField: "Position",
          editorType: "dxSelectBox",
          editorOptions: { items: positions },
        },
        {
          dataField: "State",
          editorType: "dxSelectBox",
          editorOptions: { items: states },
        },
        {
          dataField: "BirthDate",
          editorType: "dxDateBox",
          editorOptions: { displayFormat: "M/d/yyyy" },
        },
      ],
    })
    .dxForm("instance");

  gridInstance = $("#grid-container")
    .dxDataGrid({
      dataSource: tasks,
      keyExpr: "ID",
      showBorders: true,
      filterRow: { visible: true },
      headerFilter: { visible: true },
      filterSyncEnabled: true,
      columns: [
        { dataField: "Subject", width: 250 },
        { dataField: "StartDate", dataType: "date" },
        { dataField: "DueDate", dataType: "date" },
        {
          dataField: "Priority",
          caption: "Priority",
          cellTemplate: (container, options) => {
            $("<div>")
              .css({
                background: colors[options.value],
                borderRadius: "24px",
                padding: "2px 8px",
                display: "inline-block",
                textAlign: "center",
              })
              .text(options.value)
              .appendTo(container);
          },
        },
        {
          dataField: "Completion",
          caption: "Completed",
          alignment: "center",
          dataType: "boolean",
          calculateCellValue: (rowData) => rowData.Completion === 100,
          calculateFilterExpression(filterValue, selectedFilterOperation) {
            const wantsCompleted =
              selectedFilterOperation === "<>" ? !filterValue : !!filterValue;
            const rawCompletion = (rowData) => rowData.Completion;
            return wantsCompleted
              ? [rawCompletion, "=", 100]
              : [rawCompletion, "<", 100];
          },
        },
      ],
    })
    .dxDataGrid("instance");

  $("#ai-fab").dxSpeedDialAction({
    icon: "sparkle",
    closeIcon: "close",
    label: "AI Assistant",
    position: {
      my: "right bottom",
      at: "right bottom",
      of: "#grid-container",
    },
    onClick: function (e) {
      popupInstance.toggle();
    },
  });
});
